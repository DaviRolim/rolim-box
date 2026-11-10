import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workspaceMember } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import * as auth from '$lib/server/auth';
import { dictFor } from '$lib/i18n';

/**
 * POST /api/invites/[code]/accept
 * Accepts an invite and adds user to workspace
 * Requires authentication
 */
export const POST: RequestHandler = async ({ params, locals, cookies }) => {
	if (!locals.user) {
		return json({ error: dictFor(locals.locale).api.unauthorized }, { status: 401 });
	}

	const { code } = params;

	if (!code) {
		return json({ error: dictFor(locals.locale).api.inviteCodeRequired }, { status: 400 });
	}

	const invite = await auth.getInviteByCode(code);

	if (!invite) {
		return json({ error: dictFor(locals.locale).api.inviteInvalid }, { status: 404 });
	}

	if (new Date() > invite.expiresAt) {
		return json({ error: dictFor(locals.locale).api.inviteExpired }, { status: 410 });
	}

	// Check if user is already a member
	const [existingMembership] = await db
		.select()
		.from(workspaceMember)
		.where(
			and(
				eq(workspaceMember.userId, locals.user.id),
				eq(workspaceMember.workspaceId, invite.workspaceId)
			)
		);

	if (existingMembership) {
		return json(
			{
				error: dictFor(locals.locale).api.alreadyMember,
				workspaceId: invite.workspaceId
			},
			{ status: 409 }
		);
	}

	// Add user to workspace
	await auth.addUserToWorkspace(
		locals.user.id,
		invite.workspaceId,
		invite.role as 'coach' | 'member'
	);

	// Land the person in the box they just joined.
	cookies.set('activeWorkspaceId', invite.workspaceId, {
		path: '/',
		maxAge: 60 * 60 * 24 * 30,
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax'
	});

	return json({
		success: true,
		workspaceId: invite.workspaceId,
		workspaceName: invite.workspaceName,
		role: invite.role
	});
};
