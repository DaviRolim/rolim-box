import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import { workspaceMember, user, workspace } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const activeWorkspaceId = cookies.get('activeWorkspaceId');

	if (!activeWorkspaceId) {
		throw redirect(302, '/workouts');
	}

	// Get workspace details
	const [workspaceData] = await db
		.select()
		.from(workspace)
		.where(eq(workspace.id, activeWorkspaceId));

	if (!workspaceData) {
		throw redirect(302, '/workouts');
	}

	// Check if user is owner
	const isOwner = await auth.isWorkspaceOwner(locals.user.id, activeWorkspaceId);

	// Get members
	const members = await db
		.select({
			userId: workspaceMember.userId,
			email: user.email,
			role: workspaceMember.role,
			joinedAt: workspaceMember.joinedAt
		})
		.from(workspaceMember)
		.innerJoin(user, eq(workspaceMember.userId, user.id))
		.where(eq(workspaceMember.workspaceId, activeWorkspaceId));

	// Get active invites if owner
	let invites: Awaited<ReturnType<typeof auth.getWorkspaceInvites>> = [];
	if (isOwner) {
		invites = await auth.getWorkspaceInvites(activeWorkspaceId);
	}

	return {
		workspace: workspaceData,
		members,
		invites,
		isOwner,
		currentUserId: locals.user.id
	};
};
