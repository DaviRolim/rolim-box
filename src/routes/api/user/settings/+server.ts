import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { updateUserSettingsSchema } from '$lib/types/pr';
import { eq } from 'drizzle-orm';

/**
 * GET /api/user/settings
 * Returns current user's settings
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const [userData] = await db
		.select({ unitPreference: user.unitPreference })
		.from(user)
		.where(eq(user.id, locals.user.id));

	return json({ unitPreference: userData?.unitPreference ?? 'metric' });
};

/**
 * PATCH /api/user/settings
 * Updates user settings
 */
export const PATCH: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const validation = updateUserSettingsSchema.safeParse(body);
	if (!validation.success) {
		return json(
			{
				error: 'Validation failed',
				details: validation.error.flatten()
			},
			{ status: 400 }
		);
	}

	const data = validation.data;

	await db
		.update(user)
		.set({ unitPreference: data.unitPreference })
		.where(eq(user.id, locals.user.id));

	return json({ success: true, unitPreference: data.unitPreference });
};
