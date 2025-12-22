import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		// Redirect to app dashboard (which is in the (app) group)
		throw redirect(302, '/dashboard');
	} else {
		throw redirect(302, '/login');
	}
};
