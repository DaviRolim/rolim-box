import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { UnitPreference } from '$lib/types/pr';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { activeWorkspaceId } = await parent();

	// Get user's unit preference (still needed server-side)
	let unitPreference: UnitPreference = 'metric';
	if (locals.user) {
		const [userData] = await db
			.select({ unitPreference: user.unitPreference })
			.from(user)
			.where(eq(user.id, locals.user.id));
		unitPreference = (userData?.unitPreference as UnitPreference) ?? 'metric';
	}

	return {
		unitPreference,
		activeWorkspaceId
	};
};
