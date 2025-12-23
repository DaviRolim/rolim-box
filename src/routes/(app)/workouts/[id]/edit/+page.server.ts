import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = locals.user;
	if (!user) throw redirect(302, '/login');

	return { wodId: params.id };
};
