import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { isAiConfigured } from '$lib/server/ai';
import { canEditWods } from '$lib/server/wods';
import type { UnitPreference } from '$lib/types/pr';

/**
 * Everything the signed-in app needs to know about the person and their box.
 *
 * Pages below this layout deliberately have no server `load` of their own: once this data is
 * in the browser, moving between Today, WoDs, Timers and PRs needs no network, which is what
 * lets the installed app keep working offline.
 */
export const load: LayoutServerLoad = async ({ locals, cookies, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const workspaces = await auth.getUserWorkspaces(locals.user.id);

	// Read the preference straight from the database: the session cache can be a few minutes
	// behind right after it is changed in Settings.
	const [settings] = await db
		.select({ unitPreference: user.unitPreference })
		.from(user)
		.where(eq(user.id, locals.user.id));
	const unitPreference = (settings?.unitPreference ?? 'metric') as UnitPreference;

	const base = {
		user: { id: locals.user.id, email: locals.user.email },
		unitPreference,
		aiEnabled: isAiConfigured()
	};

	if (workspaces.length === 0) {
		if (url.pathname !== '/no-workspace') {
			throw redirect(302, '/no-workspace');
		}
		return {
			...base,
			workspaces: [],
			activeWorkspaceId: null,
			activeWorkspace: null,
			role: null,
			canEdit: false,
			hasNoWorkspace: true
		};
	}

	// Active workspace from the cookie, falling back to the person's first box.
	const cookieId = cookies.get('activeWorkspaceId');
	const activeWorkspace = workspaces.find((w) => w.id === cookieId) ?? workspaces[0];
	if (activeWorkspace.id !== cookieId) {
		cookies.set('activeWorkspaceId', activeWorkspace.id, {
			path: '/',
			maxAge: 60 * 60 * 24 * 30,
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax'
		});
	}

	return {
		...base,
		workspaces: workspaces.map((w) => ({ id: w.id, name: w.name, role: w.role })),
		activeWorkspaceId: activeWorkspace.id,
		activeWorkspace: { id: activeWorkspace.id, name: activeWorkspace.name, role: activeWorkspace.role },
		role: activeWorkspace.role,
		canEdit: canEditWods(activeWorkspace.role),
		hasNoWorkspace: false
	};
};
