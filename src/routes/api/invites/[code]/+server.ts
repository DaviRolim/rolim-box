import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as auth from '$lib/server/auth';

/**
 * GET /api/invites/[code]
 * Public endpoint to validate an invite code
 * Returns workspace name and role if valid
 */
export const GET: RequestHandler = async ({ params }) => {
	const { code } = params;

	if (!code) {
		return json({ error: 'Invite code is required' }, { status: 400 });
	}

	const invite = await auth.getInviteByCode(code);

	if (!invite) {
		return json({ error: 'Invalid invite code' }, { status: 404 });
	}

	// Check expiration
	if (new Date() > invite.expiresAt) {
		return json({ error: 'This invite has expired. Ask for a new one.' }, { status: 410 });
	}

	return json({
		workspaceName: invite.workspaceName,
		role: invite.role,
		code: invite.code
	});
};
