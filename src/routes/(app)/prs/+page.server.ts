import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { exercise, personalRecord, user } from '$lib/server/db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import { seedExercises } from '$lib/server/db/seed-exercises';
import type { ExerciseWithBestPR, UnitPreference, ExerciseCategory, MeasurementType } from '$lib/types/pr';

export const load: PageServerLoad = async ({ locals, parent }) => {
	// Get activeWorkspaceId from parent layout
	const { activeWorkspaceId } = await parent();
	// Ensure exercises are seeded
	await seedExercises();

	// Get all exercises
	const exercises = await db
		.select()
		.from(exercise)
		.orderBy(asc(exercise.sortOrder));

	// Get user's PRs
	const prs = locals.user
		? await db
				.select()
				.from(personalRecord)
				.where(eq(personalRecord.userId, locals.user.id))
		: [];

	// Get user's unit preference
	let unitPreference: UnitPreference = 'metric';
	if (locals.user) {
		const [userData] = await db
			.select({ unitPreference: user.unitPreference })
			.from(user)
			.where(eq(user.id, locals.user.id));
		unitPreference = (userData?.unitPreference as UnitPreference) ?? 'metric';
	}

	// Group PRs by exercise and find the best for each
	const prsByExercise = new Map<string, { value: number; date: string }>();
	for (const pr of prs) {
		const ex = exercises.find((e) => e.id === pr.exerciseId);
		if (!ex) continue;

		const existing = prsByExercise.get(pr.exerciseId);
		const isBetter =
			!existing ||
			(ex.measurementType === 'time'
				? pr.value < existing.value
				: pr.value > existing.value);

		if (isBetter) {
			prsByExercise.set(pr.exerciseId, { value: pr.value, date: pr.date });
		}
	}

	// Combine exercises with their best PR
	const exercisesWithPRs: ExerciseWithBestPR[] = exercises.map((ex) => ({
		id: ex.id,
		name: ex.name,
		category: ex.category as ExerciseCategory,
		measurementType: ex.measurementType as MeasurementType,
		sortOrder: ex.sortOrder,
		bestPR: prsByExercise.get(ex.id) ?? null
	}));

	return {
		exercises: exercisesWithPRs,
		unitPreference,
		activeWorkspaceId
	};
};
