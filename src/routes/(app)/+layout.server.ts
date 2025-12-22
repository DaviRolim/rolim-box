import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import * as auth from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const workspace = await auth.getUserWorkspace(locals.user.id);

	return {
		user: locals.user,
		workspace
	};
};
