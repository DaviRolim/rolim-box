import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workspaceMember, user } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { dictFor } from '$lib/i18n';

/**
 * GET /api/workspaces/[id]/members
 * List workspace members
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: dictFor(locals.locale).api.unauthorized }, { status: 401 });
	}

	const { id: workspaceId } = params;

	// Check if user is a member
	const [membership] = await db
		.select()
		.from(workspaceMember)
		.where(
			and(eq(workspaceMember.userId, locals.user.id), eq(workspaceMember.workspaceId, workspaceId))
		);

	if (!membership) {
		return json({ error: dictFor(locals.locale).api.notMember }, { status: 403 });
	}

	// Get all members with user info
	const members = await db
		.select({
			userId: workspaceMember.userId,
			email: user.email,
			role: workspaceMember.role,
			joinedAt: workspaceMember.joinedAt
		})
		.from(workspaceMember)
		.innerJoin(user, eq(workspaceMember.userId, user.id))
		.where(eq(workspaceMember.workspaceId, workspaceId));

	return json(members);
};
