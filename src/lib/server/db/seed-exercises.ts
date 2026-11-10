import { db } from '$lib/server/db';
import { exercise } from '$lib/server/db/schema';
import { generateId } from '$lib/server/auth';

import { EXERCISE_SEEDS, exerciseSortOrder } from './exercise-list';

export async function seedExercises(): Promise<void> {
	// Check if exercises already exist
	const existing = await db.select().from(exercise).limit(1);
	if (existing.length > 0) {
		return;
	}

	const values = EXERCISE_SEEDS.map((ex, index) => ({
		id: generateId(),
		name: ex.name,
		category: ex.category,
		measurementType: ex.measurementType,
		sortOrder: exerciseSortOrder(ex, index)
	}));

	await db.insert(exercise).values(values);
	console.log(`Seeded ${values.length} exercises`);
}
