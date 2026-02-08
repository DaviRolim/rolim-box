import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { wod, section, workspaceMember } from '$lib/server/db/schema';
import { createWoDSchema } from '$lib/types/wod';
import { generateId } from '$lib/server/auth';
import { eq, and, desc, inArray, asc, lt } from 'drizzle-orm';

/**
 * GET /api/wods?workspaceId={id}
 * Returns WoD[] ordered by date DESC
 * Validates workspace membership
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	// Check authentication
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Get workspaceId from query params
	const workspaceId = url.searchParams.get('workspaceId');
	if (!workspaceId) {
		return json({ error: 'workspaceId query parameter is required' }, { status: 400 });
	}

	// Validate workspace membership
	const [membership] = await db
		.select()
		.from(workspaceMember)
		.where(
			and(
				eq(workspaceMember.userId, locals.user.id),
				eq(workspaceMember.workspaceId, workspaceId)
			)
		);

	if (!membership) {
		return json({ error: 'Access denied: not a member of this workspace' }, { status: 403 });
	}

	// Pagination params
	const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
	const cursor = url.searchParams.get('cursor'); // ISO date string

	// Build query conditions
	const conditions = [eq(wod.workspaceId, workspaceId)];
	if (cursor) {
		conditions.push(lt(wod.date, cursor));
	}

	// Fetch one extra to determine if there are more pages
	const wods = await db
		.select()
		.from(wod)
		.where(and(...conditions))
		.orderBy(desc(wod.date))
		.limit(limit + 1);

	// Determine next cursor
	let nextCursor: string | null = null;
	if (wods.length > limit) {
		const extra = wods.pop()!;
		nextCursor = extra.date;
	}

	// Fetch ALL sections for ALL wods in ONE query (fixes N+1 issue)
	const wodIds = wods.map((w) => w.id);
	const allSections = wodIds.length > 0
		? await db
			.select()
			.from(section)
			.where(inArray(section.wodId, wodIds))
			.orderBy(asc(section.order))
		: [];

	// Group sections by wodId in memory (fast)
	const sectionsMap = new Map<string, typeof allSections[number][]>();
	for (const sect of allSections) {
		if (!sectionsMap.has(sect.wodId)) {
			sectionsMap.set(sect.wodId, []);
		}
		sectionsMap.get(sect.wodId)!.push(sect);
	}

	// Combine wods with their sections
	const wodsWithSections = wods.map((w) => ({
		id: w.id,
		workspaceId: w.workspaceId,
		date: w.date,
		description: w.description,
		sections: sectionsMap.get(w.id) || [],
		createdAt: w.createdAt,
		updatedAt: w.updatedAt
	}));

	return json({ wods: wodsWithSections, nextCursor });
};

/**
 * POST /api/wods
 * Creates a new WoD with sections
 * Validates with createWoDSchema
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	// Check authentication
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Parse and validate request body
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const validation = createWoDSchema.safeParse(body);
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

	// Validate workspace membership
	const [membership] = await db
		.select()
		.from(workspaceMember)
		.where(
			and(
				eq(workspaceMember.userId, locals.user.id),
				eq(workspaceMember.workspaceId, data.workspaceId)
			)
		);

	if (!membership) {
		return json({ error: 'Access denied: not a member of this workspace' }, { status: 403 });
	}

	// Check if user has edit permissions (owner or coach only)
	if (membership.role === 'member') {
		return json({ error: 'Members cannot create workouts' }, { status: 403 });
	}

	// Create WoD with sections in a transaction
	const result = await db.transaction(async (tx) => {
		const wodId = generateId();
		const now = new Date();

		const [newWod] = await tx
			.insert(wod)
			.values({
				id: wodId,
				workspaceId: data.workspaceId,
				date: data.date,
				description: data.description,
				createdAt: now,
				updatedAt: now
			})
			.returning();

		// Create sections
		const createdSections = [];
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
			createdSections.push(newSection);
		}

		// Return created WoD with sections
		return {
			id: newWod.id,
			workspaceId: newWod.workspaceId,
			date: newWod.date,
			description: newWod.description,
			sections: createdSections,
			createdAt: newWod.createdAt,
			updatedAt: newWod.updatedAt
		};
	});

	return json(result, { status: 201 });
};
