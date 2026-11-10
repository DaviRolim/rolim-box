import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workspaceMember } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import * as auth from '$lib/server/auth';
import { dictFor } from '$lib/i18n';

/**
 * DELETE /api/workspaces/[id]/members/[userId]
 * Remove a member (owner only, cannot remove self if sole owner)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: dictFor(locals.locale).api.unauthorized }, { status: 401 });
	}

	const { id: workspaceId, userId } = params;

	// Check if requester is owner
	const isOwner = await auth.isWorkspaceOwner(locals.user.id, workspaceId);
	if (!isOwner) {
		return json({ error: dictFor(locals.locale).api.ownersOnly }, { status: 403 });
	}

	// Check if trying to remove self
	if (userId === locals.user.id) {
		// Count other owners
		const owners = await db
			.select()
			.from(workspaceMember)
			.where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.role, 'owner')));

		if (owners.length <= 1) {
			return json({ error: dictFor(locals.locale).api.soleOwner }, { status: 400 });
		}
	}

	// Remove member
	await db
		.delete(workspaceMember)
		.where(and(eq(workspaceMember.userId, userId), eq(workspaceMember.workspaceId, workspaceId)));

	return json({ success: true });
};
