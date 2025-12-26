import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workspaceMember } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import * as auth from '$lib/server/auth';

/**
 * POST /api/invites/[code]/accept
 * Accepts an invite and adds user to workspace
 * Requires authentication
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { code } = params;

	if (!code) {
		return json({ error: 'Invite code is required' }, { status: 400 });
	}

	const invite = await auth.getInviteByCode(code);

	if (!invite) {
		return json({ error: 'Invalid invite code' }, { status: 404 });
	}

	if (new Date() > invite.expiresAt) {
		return json({ error: 'This invite has expired. Ask for a new one.' }, { status: 410 });
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
		return json({
			error: 'You are already a member of this workspace',
			workspaceId: invite.workspaceId
		}, { status: 409 });
	}

	// Add user to workspace
	await auth.addUserToWorkspace(locals.user.id, invite.workspaceId, invite.role as 'coach' | 'member');

	return json({
		success: true,
		workspaceId: invite.workspaceId,
		workspaceName: invite.workspaceName,
		role: invite.role
	});
};
