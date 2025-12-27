import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { personalRecord, exercise } from '$lib/server/db/schema';
import { bulkImportSchema } from '$lib/types/pr';
import { generateId } from '$lib/server/auth';
import { inArray } from 'drizzle-orm';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const validation = bulkImportSchema.safeParse(body);
	if (!validation.success) {
		return json(
			{
				error: 'Validation failed',
				details: validation.error.flatten()
			},
			{ status: 400 }
		);
	}

	const { prs } = validation.data;

	// Verify all exercises exist
	const exerciseIds = [...new Set(prs.map((pr) => pr.exerciseId))];
	const existingExercises = await db
		.select({ id: exercise.id })
		.from(exercise)
		.where(inArray(exercise.id, exerciseIds));

	const existingIds = new Set(existingExercises.map((e) => e.id));
	const invalidIds = exerciseIds.filter((id) => !existingIds.has(id));

	if (invalidIds.length > 0) {
		return json(
			{
				error: 'Some exercises not found',
				invalidIds
			},
			{ status: 400 }
		);
	}

	// Insert all PRs
	const now = new Date();
	const today = now.toISOString().split('T')[0];

	const prRecords = prs.map((pr) => ({
		id: generateId(),
		userId: locals.user!.id,
		exerciseId: pr.exerciseId,
		value: pr.value,
		note: 'Imported from image',
		date: today,
		createdAt: now,
		updatedAt: now
	}));

	try {
		await db.insert(personalRecord).values(prRecords);

		return json({
			success: true,
			imported: prRecords.length
		});
	} catch (error) {
		console.error('Bulk import error:', error);
		return json({ error: 'Failed to import PRs' }, { status: 500 });
	}
};
