import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import * as auth from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals, cookies, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const workspaces = await auth.getUserWorkspaces(locals.user.id);

	// If user has no workspaces, redirect to no-workspace page
	if (workspaces.length === 0) {
		if (url.pathname !== '/no-workspace') {
			throw redirect(302, '/no-workspace');
		}
		return {
			user: locals.user,
			workspaces: [],
			activeWorkspaceId: undefined,
			hasNoWorkspace: true
		};
	}

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
		activeWorkspaceId,
		hasNoWorkspace: false
	};
};
