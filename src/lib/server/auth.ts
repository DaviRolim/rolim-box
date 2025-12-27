import type { RequestEvent } from '@sveltejs/kit';
import { eq, and, gt } from 'drizzle-orm';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import { hash, verify } from '@node-rs/argon2';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const sessionCookieName = 'auth-session';

export function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(18));
	return encodeBase64url(bytes);
}

export function generateId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return encodeHexLowerCase(bytes);
}

export function generateInviteCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for readability
	let code = '';
	const bytes = crypto.getRandomValues(new Uint8Array(6));
	for (const byte of bytes) {
		code += chars[byte % chars.length];
	}
	// Format as XXX-XXX for readability
	return `${code.slice(0, 3)}-${code.slice(3, 6)}`;
}

export async function hashPassword(password: string): Promise<string> {
	return hash(password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	});
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
	return verify(hash, password);
}

export async function createUser(email: string, password: string): Promise<table.User> {
	const id = generateId();
	const passwordHash = await hashPassword(password);
	const now = new Date();

	const [newUser] = await db
		.insert(table.user)
		.values({
			id,
			email: email.toLowerCase(),
			passwordHash,
			createdAt: now
		})
		.returning();

	return newUser;
}

export async function createWorkspaceForUser(
	userId: string,
	workspaceName: string = 'My Workspace'
): Promise<table.Workspace> {
	const workspaceId = generateId();
	const now = new Date();

	const [newWorkspace] = await db
		.insert(table.workspace)
		.values({
			id: workspaceId,
			name: workspaceName,
			createdAt: now
		})
		.returning();

	await db.insert(table.workspaceMember).values({
		userId,
		workspaceId,
		role: 'owner',
		joinedAt: now
	});

	return newWorkspace;
}

export async function findUserByEmail(email: string): Promise<table.User | undefined> {
	const [user] = await db
		.select()
		.from(table.user)
		.where(eq(table.user.email, email.toLowerCase()));
	return user;
}

export async function getUserWorkspace(userId: string): Promise<table.Workspace | undefined> {
	const result = await db
		.select({ workspace: table.workspace })
		.from(table.workspaceMember)
		.innerJoin(table.workspace, eq(table.workspaceMember.workspaceId, table.workspace.id))
		.where(eq(table.workspaceMember.userId, userId))
		.limit(1);

	return result[0]?.workspace;
}

export async function getUserWorkspaces(userId: string): Promise<(table.Workspace & { role: string })[]> {
	const results = await db
		.select({
			id: table.workspace.id,
			name: table.workspace.name,
			createdAt: table.workspace.createdAt,
			role: table.workspaceMember.role
		})
		.from(table.workspaceMember)
		.innerJoin(table.workspace, eq(table.workspaceMember.workspaceId, table.workspace.id))
		.where(eq(table.workspaceMember.userId, userId));

	return results;
}

export async function addUserToWorkspace(
	userId: string,
	workspaceId: string,
	role: 'coach' | 'member'
): Promise<void> {
	await db.insert(table.workspaceMember).values({
		userId,
		workspaceId,
		role,
		joinedAt: new Date()
	});
}

export async function isWorkspaceOwner(userId: string, workspaceId: string): Promise<boolean> {
	const [membership] = await db
		.select()
		.from(table.workspaceMember)
		.where(
			and(
				eq(table.workspaceMember.userId, userId),
				eq(table.workspaceMember.workspaceId, workspaceId),
				eq(table.workspaceMember.role, 'owner')
			)
		);
	return !!membership;
}

export async function createWorkspaceInvite(
	workspaceId: string,
	createdBy: string,
	role: 'coach' | 'member'
): Promise<table.WorkspaceInvite> {
	const id = generateId();
	const code = generateInviteCode();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

	const [invite] = await db
		.insert(table.workspaceInvite)
		.values({
			id,
			code,
			workspaceId,
			role,
			createdBy,
			createdAt: now,
			expiresAt
		})
		.returning();

	return invite;
}

export async function getInviteByCode(code: string): Promise<(table.WorkspaceInvite & { workspaceName: string }) | undefined> {
	const [result] = await db
		.select({
			id: table.workspaceInvite.id,
			code: table.workspaceInvite.code,
			workspaceId: table.workspaceInvite.workspaceId,
			role: table.workspaceInvite.role,
			createdBy: table.workspaceInvite.createdBy,
			createdAt: table.workspaceInvite.createdAt,
			expiresAt: table.workspaceInvite.expiresAt,
			workspaceName: table.workspace.name
		})
		.from(table.workspaceInvite)
		.innerJoin(table.workspace, eq(table.workspaceInvite.workspaceId, table.workspace.id))
		.where(eq(table.workspaceInvite.code, code.toUpperCase()));

	return result;
}

export async function getWorkspaceInvites(workspaceId: string): Promise<table.WorkspaceInvite[]> {
	const now = new Date();
	return db
		.select()
		.from(table.workspaceInvite)
		.where(
			and(
				eq(table.workspaceInvite.workspaceId, workspaceId),
				gt(table.workspaceInvite.expiresAt, now)
			)
		);
}

export async function deleteInvite(inviteId: string): Promise<void> {
	await db.delete(table.workspaceInvite).where(eq(table.workspaceInvite.id, inviteId));
}

export async function createSession(token: string, userId: string): Promise<table.Session> {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
	const session: table.Session = {
		id: sessionId,
		userId,
		expiresAt: new Date(Date.now() + DAY_IN_MS * 30)
	};
	await db.insert(table.session).values(session);
	return session;
}

export async function validateSessionToken(
	token: string
): Promise<{ session: table.Session | null; user: Omit<table.User, 'passwordHash'> | null }> {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
	const [result] = await db
		.select({
			user: {
				id: table.user.id,
				email: table.user.email,
				createdAt: table.user.createdAt,
				unitPreference: table.user.unitPreference
			},
			session: table.session
		})
		.from(table.session)
		.innerJoin(table.user, eq(table.session.userId, table.user.id))
		.where(eq(table.session.id, sessionId));

	if (!result) {
		return { session: null, user: null };
	}

	const { session, user } = result;

	const sessionExpired = Date.now() >= session.expiresAt.getTime();
	if (sessionExpired) {
		await db.delete(table.session).where(eq(table.session.id, session.id));
		return { session: null, user: null };
	}

	const renewSession = Date.now() >= session.expiresAt.getTime() - DAY_IN_MS * 15;
	if (renewSession) {
		session.expiresAt = new Date(Date.now() + DAY_IN_MS * 30);
		await db
			.update(table.session)
			.set({ expiresAt: session.expiresAt })
			.where(eq(table.session.id, session.id));
	}

	return { session, user };
}

export type SessionValidationResult = Awaited<ReturnType<typeof validateSessionToken>>;

export async function invalidateSession(sessionId: string): Promise<void> {
	await db.delete(table.session).where(eq(table.session.id, sessionId));
}

export function setSessionTokenCookie(event: RequestEvent, token: string, expiresAt: Date): void {
	event.cookies.set(sessionCookieName, token, {
		expires: expiresAt,
		path: '/'
	});
}

export function deleteSessionTokenCookie(event: RequestEvent): void {
	event.cookies.delete(sessionCookieName, {
		path: '/'
	});
}
