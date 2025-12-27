import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { unitPreference: 'metric' };
	}

	const [userData] = await db
		.select({ unitPreference: user.unitPreference })
		.from(user)
		.where(eq(user.id, locals.user.id));

	return {
		unitPreference: userData?.unitPreference ?? 'metric'
	};
};
