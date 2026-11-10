import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as auth from '$lib/server/auth';
import { dictFor } from '$lib/i18n';

/**
 * GET /api/invites/[code]
 * Public endpoint to validate an invite code
 * Returns workspace name and role if valid
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { code } = params;

	if (!code) {
		return json({ error: dictFor(locals.locale).api.inviteCodeRequired }, { status: 400 });
	}

	const invite = await auth.getInviteByCode(code);

	if (!invite) {
		return json({ error: dictFor(locals.locale).api.inviteInvalid }, { status: 404 });
	}

	// Check expiration
	if (new Date() > invite.expiresAt) {
		return json({ error: dictFor(locals.locale).api.inviteExpired }, { status: 410 });
	}

	return json({
		workspaceName: invite.workspaceName,
		role: invite.role,
		code: invite.code
	});
};
