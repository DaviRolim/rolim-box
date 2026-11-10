import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import { workspaceInvite } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { dictFor } from '$lib/i18n';

/**
 * DELETE /api/workspaces/[id]/invites/[code]
 * Revoke an invite (owner only)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: dictFor(locals.locale).api.unauthorized }, { status: 401 });
	}

	const { id: workspaceId, code } = params;

	// Check if user is owner
	const isOwner = await auth.isWorkspaceOwner(locals.user.id, workspaceId);
	if (!isOwner) {
		return json({ error: dictFor(locals.locale).api.ownersOnly }, { status: 403 });
	}

	// Find and delete the invite
	const [invite] = await db
		.select()
		.from(workspaceInvite)
		.where(and(eq(workspaceInvite.workspaceId, workspaceId), eq(workspaceInvite.code, code)));

	if (!invite) {
		return json({ error: dictFor(locals.locale).api.inviteNotFound }, { status: 404 });
	}

	await auth.deleteInvite(invite.id);

	return json({ success: true });
};
