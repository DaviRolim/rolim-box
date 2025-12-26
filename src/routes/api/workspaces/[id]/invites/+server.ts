import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as auth from '$lib/server/auth';

/**
 * GET /api/workspaces/[id]/invites
 * List active invites (owner only)
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id: workspaceId } = params;

	// Check if user is owner
	const isOwner = await auth.isWorkspaceOwner(locals.user.id, workspaceId);
	if (!isOwner) {
		return json({ error: 'Only workspace owners can view invites' }, { status: 403 });
	}

	const invites = await auth.getWorkspaceInvites(workspaceId);

	return json(invites);
};

/**
 * POST /api/workspaces/[id]/invites
 * Create a new invite (owner only)
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id: workspaceId } = params;

	// Check if user is owner
	const isOwner = await auth.isWorkspaceOwner(locals.user.id, workspaceId);
	if (!isOwner) {
		return json({ error: 'Only workspace owners can create invites' }, { status: 403 });
	}

	const body = await request.json();
	const role = body.role as 'coach' | 'member';

	if (!role || !['coach', 'member'].includes(role)) {
		return json({ error: 'Invalid role. Must be "coach" or "member"' }, { status: 400 });
	}

	const invite = await auth.createWorkspaceInvite(workspaceId, locals.user.id, role);

	return json(invite, { status: 201 });
};
