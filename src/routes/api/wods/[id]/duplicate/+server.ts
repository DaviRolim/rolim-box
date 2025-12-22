import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { wod, section, workspaceMember } from '$lib/server/db/schema';
import { generateId } from '$lib/server/auth';
import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Helper function to validate workspace membership for a WoD
 */
async function validateWodAccess(userId: string, wodId: string): Promise<{ error?: string; wod?: typeof wod.$inferSelect }> {
	// Fetch WoD
	const [wodRecord] = await db.select().from(wod).where(eq(wod.id, wodId));

	if (!wodRecord) {
		return { error: 'WoD not found' };
	}

	// Validate workspace membership
	const [membership] = await db
		.select()
		.from(workspaceMember)
		.where(
			and(
				eq(workspaceMember.userId, userId),
				eq(workspaceMember.workspaceId, wodRecord.workspaceId)
			)
		);

	if (!membership) {
		return { error: 'Access denied: not a member of this workspace' };
	}

	return { wod: wodRecord };
}

/**
 * Schema for duplicate request body
 */
const duplicateRequestSchema = z.object({
	newDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
		.refine((date) => {
			const parsed = new Date(date);
			return !isNaN(parsed.getTime());
		}, 'Invalid date')
		.optional()
});

/**
 * POST /api/wods/[id]/duplicate
 * Duplicates a WoD with new IDs
 * Optional { newDate } body (defaults to today)
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	// Check authentication
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const wodId = params.id;

	// Validate access to source WoD
	const { error, wod: sourceWod } = await validateWodAccess(locals.user.id, wodId);
	if (error) {
		const status = error === 'WoD not found' ? 404 : 403;
		return json({ error }, { status });
	}

	// Parse and validate request body (optional newDate)
	let body;
	try {
		body = await request.json();
	} catch {
		body = {};
	}

	const validation = duplicateRequestSchema.safeParse(body);
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

	// Determine new date (default to today in YYYY-MM-DD format)
	const newDate = data.newDate || new Date().toISOString().split('T')[0];

	// Fetch source sections
	const sourceSections = await db
		.select()
		.from(section)
		.where(eq(section.wodId, wodId))
		.orderBy(asc(section.order));

	// Create duplicate WoD with sections in a transaction
	const result = await db.transaction(async (tx) => {
		const newWodId = generateId();
		const now = new Date();

		const [newWod] = await tx
			.insert(wod)
			.values({
				id: newWodId,
				workspaceId: sourceWod!.workspaceId,
				date: newDate,
				description: sourceWod!.description,
				createdAt: now,
				updatedAt: now
			})
			.returning();

		// Duplicate sections with new IDs
		const newSections = [];
		for (const sourceSection of sourceSections) {
			const [newSection] = await tx
				.insert(section)
				.values({
					id: generateId(),
					wodId: newWodId,
					type: sourceSection.type,
					name: sourceSection.name,
					content: sourceSection.content,
					order: sourceSection.order,
					timerConfig: sourceSection.timerConfig
				})
				.returning();
			newSections.push(newSection);
		}

		// Return duplicated WoD with sections
		return {
			id: newWod.id,
			workspaceId: newWod.workspaceId,
			date: newWod.date,
			description: newWod.description,
			sections: newSections,
			createdAt: newWod.createdAt,
			updatedAt: newWod.updatedAt
		};
	});

	return json(result, { status: 201 });
};
