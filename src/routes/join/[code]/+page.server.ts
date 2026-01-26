import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import { workspaceMember } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { code } = params;

	const invite = await auth.getInviteByCode(code);

	if (!invite) {
		return { error: 'invalid', invite: null, isLoggedIn: !!locals.user, alreadyMember: false };
	}

	if (new Date() > invite.expiresAt) {
		return { error: 'expired', invite: null, isLoggedIn: !!locals.user, alreadyMember: false };
	}

	// Check if logged-in user is already a member
	let alreadyMember = false;
	if (locals.user) {
		const [existing] = await db
			.select()
			.from(workspaceMember)
			.where(
				and(
					eq(workspaceMember.userId, locals.user.id),
					eq(workspaceMember.workspaceId, invite.workspaceId)
				)
			);
		alreadyMember = !!existing;
	}

	return {
		error: null,
		invite: {
			code: invite.code,
			workspaceName: invite.workspaceName,
			role: invite.role,
			workspaceId: invite.workspaceId
		},
		isLoggedIn: !!locals.user,
		alreadyMember
	};
};

export const actions: Actions = {
	default: async ({ request, params, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email');
		const password = formData.get('password');
		const inviteCode = params.code;

		if (typeof email !== 'string' || !email.includes('@')) {
			return fail(400, { error: 'Invalid email address' });
		}

		if (typeof password !== 'string' || password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters' });
		}

		// Validate invite
		const invite = await auth.getInviteByCode(inviteCode);
		if (!invite || new Date() > invite.expiresAt) {
			return fail(400, { error: 'Invalid or expired invite' });
		}

		// Check if email exists
		const existingUser = await auth.findUserByEmail(email);
		if (existingUser) {
			return fail(400, { error: 'Email already registered. Please log in instead.' });
		}

		// Create user (without personal workspace)
		const user = await auth.createUser(email, password);

		// Add to invited workspace
		await auth.addUserToWorkspace(user.id, invite.workspaceId, invite.role as 'coach' | 'member');

		// Create session
		const token = auth.generateSessionToken();
		const session = await auth.createSession(token, user.id);

		cookies.set(auth.sessionCookieName, token, {
			expires: session.expiresAt,
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax'
		});

		// Set the joined workspace as active
		cookies.set('activeWorkspaceId', invite.workspaceId, {
			path: '/',
			maxAge: 60 * 60 * 24 * 30,
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax'
		});

		throw redirect(302, '/workouts');
	}
};
