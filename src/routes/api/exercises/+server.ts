import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { exercise } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

/**
 * GET /api/exercises
 * Returns all predefined exercises ordered by sortOrder
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const exercises = await db
		.select()
		.from(exercise)
		.orderBy(asc(exercise.sortOrder));

	return json(exercises);
};
