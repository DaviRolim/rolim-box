import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import * as auth from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const workspaces = await auth.getUserWorkspaces(locals.user.id);

	// Get active workspace from cookie, or default to first
	let activeWorkspaceId = cookies.get('activeWorkspaceId');

	// Validate activeWorkspaceId exists in user's workspaces
	const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
	if (!activeWorkspace && workspaces.length > 0) {
		activeWorkspaceId = workspaces[0].id;
	}

	return {
		user: locals.user,
		workspaces,
		activeWorkspaceId
	};
};
