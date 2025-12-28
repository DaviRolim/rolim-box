import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { exercise } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import { seedExercises } from '$lib/server/db/seed-exercises';

export const GET: RequestHandler = async () => {
	// Ensure exercises are seeded
	await seedExercises();

	const exercises = await db
		.select({
			id: exercise.id,
			name: exercise.name,
			category: exercise.category,
			measurementType: exercise.measurementType,
			sortOrder: exercise.sortOrder
		})
		.from(exercise)
		.orderBy(asc(exercise.sortOrder));

	return json(exercises);
};
