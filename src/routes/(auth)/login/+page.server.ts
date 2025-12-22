import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as auth from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email');
		const password = formData.get('password');

		if (typeof email !== 'string' || !email.includes('@')) {
			return fail(400, { error: 'Invalid email address' });
		}

		if (typeof password !== 'string' || password.length < 1) {
			return fail(400, { error: 'Password is required' });
		}

		const user = await auth.findUserByEmail(email);
		if (!user) {
			return fail(400, { error: 'Invalid email or password' });
		}

		const validPassword = await auth.verifyPassword(user.passwordHash, password);
		if (!validPassword) {
			return fail(400, { error: 'Invalid email or password' });
		}

		const token = auth.generateSessionToken();
		const session = await auth.createSession(token, user.id);

		cookies.set(auth.sessionCookieName, token, {
			expires: session.expiresAt,
			path: '/'
		});

		throw redirect(302, '/');
	}
};
