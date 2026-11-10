import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workspaceMember } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { dictFor } from '$lib/i18n';

/**
 * POST /api/workspaces/active
 * Sets the active workspace cookie
 */
export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	if (!locals.user) {
		return json({ error: dictFor(locals.locale).api.unauthorized }, { status: 401 });
	}

	const body = await request.json();
	const { workspaceId } = body;

	if (!workspaceId) {
		return json({ error: dictFor(locals.locale).api.workspaceRequired }, { status: 400 });
	}

	// Validate user is a member of this workspace
	const [membership] = await db
		.select()
		.from(workspaceMember)
		.where(
			and(eq(workspaceMember.userId, locals.user.id), eq(workspaceMember.workspaceId, workspaceId))
		);

	if (!membership) {
		return json({ error: dictFor(locals.locale).api.notMember }, { status: 403 });
	}

	// Set cookie (30 days) with security attributes
	cookies.set('activeWorkspaceId', workspaceId, {
		path: '/',
		maxAge: 60 * 60 * 24 * 30,
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax'
	});

	return json({ success: true });
};
