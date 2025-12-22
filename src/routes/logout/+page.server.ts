import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as auth from '$lib/server/auth';

export const load: PageServerLoad = async () => {
	throw redirect(302, '/');
};

export const actions: Actions = {
	default: async (event) => {
		if (event.locals.session) {
			await auth.invalidateSession(event.locals.session.id);
		}
		auth.deleteSessionTokenCookie(event);
		throw redirect(302, '/login');
	}
};
