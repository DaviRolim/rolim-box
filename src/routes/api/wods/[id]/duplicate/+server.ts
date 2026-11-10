import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { wod, section } from '$lib/server/db/schema';
import { generateId } from '$lib/server/auth';
import { canEditWods, getSections, getWodAccess, serializeWod } from '$lib/server/wods';
import { isIsoDate, todayIso } from '$lib/date';
import { z } from 'zod';

const duplicateRequestSchema = z.object({
	newDate: z.string().refine(isIsoDate, 'Date must be a valid YYYY-MM-DD date').optional()
});

/**
 * POST /api/wods/[id]/duplicate
 * Copies a WoD (new ids) onto another date. Optional { newDate } body, defaults to today.
 * Coaches and owners only.
 *
 * The app itself duplicates on the device and syncs a normal create (so it works offline);
 * this endpoint is kept for API clients.
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const access = await getWodAccess(locals.user.id, params.id);
	if (!access.ok) {
		return json({ error: access.error }, { status: access.status });
	}
	if (!canEditWods(access.membership.role)) {
		return json({ error: 'Members cannot duplicate workouts' }, { status: 403 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		body = {};
	}

	const validation = duplicateRequestSchema.safeParse(body);
	if (!validation.success) {
		return json(
			{ error: 'Validation failed', details: validation.error.flatten() },
			{ status: 400 }
		);
	}

	const newDate = validation.data.newDate ?? todayIso();
	const sourceSections = await getSections(params.id);

	const result = await db.transaction(async (tx) => {
		const newWodId = generateId();
		const now = new Date();

		const [newWod] = await tx
			.insert(wod)
			.values({
				id: newWodId,
				workspaceId: access.wod.workspaceId,
				date: newDate,
				description: access.wod.description,
				createdAt: now,
				updatedAt: now
			})
			.returning();

		const rows = sourceSections.map((source) => ({
			id: generateId(),
			wodId: newWodId,
			type: source.type,
			name: source.name,
			content: source.content,
			order: source.order,
			timerConfig: source.timerConfig
		}));
		const newSections = rows.length > 0 ? await tx.insert(section).values(rows).returning() : [];
		newSections.sort((a, b) => a.order - b.order);

		return serializeWod(newWod, newSections);
	});

	return json(result, { status: 201 });
};
