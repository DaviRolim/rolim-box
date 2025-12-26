import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST /api/workspaces/active
 * Sets the active workspace cookie
 */
export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const { workspaceId } = body;

	if (!workspaceId) {
		return json({ error: 'workspaceId is required' }, { status: 400 });
	}

	// Set cookie (30 days)
	cookies.set('activeWorkspaceId', workspaceId, {
		path: '/',
		maxAge: 60 * 60 * 24 * 30
	});

	return json({ success: true });
};
