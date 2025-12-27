import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { personalRecord, exercise } from '$lib/server/db/schema';
import { createPRSchema } from '$lib/types/pr';
import { generateId } from '$lib/server/auth';
import { eq, and, desc } from 'drizzle-orm';

/**
 * GET /api/prs?exerciseId={id}
 * Returns user's PRs, optionally filtered by exerciseId
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const exerciseId = url.searchParams.get('exerciseId');

	let query = db
		.select()
		.from(personalRecord)
		.where(eq(personalRecord.userId, locals.user.id))
		.orderBy(desc(personalRecord.date));

	if (exerciseId) {
		query = db
			.select()
			.from(personalRecord)
			.where(
				and(
					eq(personalRecord.userId, locals.user.id),
					eq(personalRecord.exerciseId, exerciseId)
				)
			)
			.orderBy(desc(personalRecord.date));
	}

	const prs = await query;
	return json(prs);
};

/**
 * POST /api/prs
 * Creates a new PR
 */
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

	const validation = createPRSchema.safeParse(body);
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

	// Verify exercise exists
	const [ex] = await db
		.select()
		.from(exercise)
		.where(eq(exercise.id, data.exerciseId));

	if (!ex) {
		return json({ error: 'Exercise not found' }, { status: 404 });
	}

	const now = new Date();
	const [newPR] = await db
		.insert(personalRecord)
		.values({
			id: generateId(),
			userId: locals.user.id,
			exerciseId: data.exerciseId,
			value: data.value,
			note: data.note ?? null,
			date: data.date,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	return json(newPR, { status: 201 });
};
