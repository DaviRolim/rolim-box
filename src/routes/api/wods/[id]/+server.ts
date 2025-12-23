import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { wod, section, workspaceMember } from '$lib/server/db/schema';
import { updateWoDSchema } from '$lib/types/wod';
import { generateId } from '$lib/server/auth';
import { eq, and, asc } from 'drizzle-orm';

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
 * GET /api/wods/[id]
 * Returns WoD with all sections
 * Validates workspace membership
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	// Check authentication
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const wodId = params.id;

	// Validate access
	const { error, wod: wodRecord } = await validateWodAccess(locals.user.id, wodId);
	if (error) {
		const status = error === 'WoD not found' ? 404 : 403;
		return json({ error }, { status });
	}

	// Fetch sections
	const sections = await db
		.select()
		.from(section)
		.where(eq(section.wodId, wodId))
		.orderBy(asc(section.order));

	// Return WoD with sections
	const result = {
		id: wodRecord!.id,
		workspaceId: wodRecord!.workspaceId,
		date: wodRecord!.date,
		description: wodRecord!.description,
		sections,
		createdAt: wodRecord!.createdAt,
		updatedAt: wodRecord!.updatedAt
	};

	return json(result);
};

/**
 * PUT /api/wods/[id]
 * Updates a WoD and replaces sections entirely
 */
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	// Check authentication
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const wodId = params.id;

	// Validate access
	const { error, wod: wodRecord } = await validateWodAccess(locals.user.id, wodId);
	if (error) {
		const status = error === 'WoD not found' ? 404 : 403;
		return json({ error }, { status });
	}

	// Parse and validate request body
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const validation = updateWoDSchema.safeParse(body);
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

	// Update WoD with sections in a transaction
	const result = await db.transaction(async (tx) => {
		// Update WoD
		const updateData: Partial<typeof wod.$inferInsert> = {
			updatedAt: new Date()
		};

		if (data.date !== undefined) {
			updateData.date = data.date;
		}
		if (data.description !== undefined) {
			updateData.description = data.description;
		}

		const [updatedWod] = await tx
			.update(wod)
			.set(updateData)
			.where(eq(wod.id, wodId))
			.returning();

		// Replace sections if provided
		let updatedSections = [];
		if (data.sections !== undefined) {
			// Delete all existing sections
			await tx.delete(section).where(eq(section.wodId, wodId));

			// Create new sections
			for (const sectionData of data.sections) {
				const [newSection] = await tx
					.insert(section)
					.values({
						id: generateId(),
						wodId: wodId,
						type: sectionData.type,
						name: sectionData.name,
						content: sectionData.content,
						order: sectionData.order,
						timerConfig: sectionData.timerConfig ?? null
					})
					.returning();
				updatedSections.push(newSection);
			}
		} else {
			// Keep existing sections
			updatedSections = await tx
				.select()
				.from(section)
				.where(eq(section.wodId, wodId))
				.orderBy(asc(section.order));
		}

		// Return updated WoD with sections
		return {
			id: updatedWod.id,
			workspaceId: updatedWod.workspaceId,
			date: updatedWod.date,
			description: updatedWod.description,
			sections: updatedSections,
			createdAt: updatedWod.createdAt,
			updatedAt: updatedWod.updatedAt
		};
	});

	return json(result);
};

/**
 * DELETE /api/wods/[id]
 * Deletes a WoD (cascade deletes sections)
 * Returns 204 No Content
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	// Check authentication
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const wodId = params.id;

	// Validate access
	const { error } = await validateWodAccess(locals.user.id, wodId);
	if (error) {
		const status = error === 'WoD not found' ? 404 : 403;
		return json({ error }, { status });
	}

	// Delete WoD (sections are cascade deleted due to DB constraint)
	await db.delete(wod).where(eq(wod.id, wodId));

	// Return 204 No Content
	return new Response(null, { status: 204 });
};
