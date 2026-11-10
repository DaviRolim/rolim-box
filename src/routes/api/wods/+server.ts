import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dictFor } from '$lib/i18n';
import { db } from '$lib/server/db';
import { wod, section } from '$lib/server/db/schema';
import { createWoDSchema } from '$lib/types/wod';
import { generateId } from '$lib/server/auth';
import {
	buildSectionRows,
	canEditWods,
	getMembership,
	getSections,
	serializeWod
} from '$lib/server/wods';
import { eq, and, desc, inArray, asc, lt } from 'drizzle-orm';

/**
 * GET /api/wods?workspaceId={id}&cursor={date}&limit={n}
 * Returns { wods, nextCursor } ordered by date DESC.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const d = dictFor(locals.locale);
	if (!locals.user) {
		return json({ error: d.api.unauthorized }, { status: 401 });
	}

	const workspaceId = url.searchParams.get('workspaceId');
	if (!workspaceId) {
		return json({ error: d.editor.api.workspaceRequired }, { status: 400 });
	}

	const membership = await getMembership(locals.user.id, workspaceId);
	if (!membership) {
		return json({ error: d.api.notMember }, { status: 403 });
	}

	const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
	const cursor = url.searchParams.get('cursor'); // ISO date string

	const conditions = [eq(wod.workspaceId, workspaceId)];
	if (cursor) {
		conditions.push(lt(wod.date, cursor));
	}

	// Fetch one extra to determine if there are more pages
	const wods = await db
		.select()
		.from(wod)
		.where(and(...conditions))
		.orderBy(desc(wod.date), desc(wod.createdAt))
		.limit(limit + 1);

	let nextCursor: string | null = null;
	if (wods.length > limit) {
		wods.pop();
		// Keyset pagination on the date: never split a day across two pages, or the
		// second WoD of that day would be skipped by the `date < cursor` filter.
		const lastDate = wods[wods.length - 1].date;
		const sameDay = await db
			.select()
			.from(wod)
			.where(and(eq(wod.workspaceId, workspaceId), eq(wod.date, lastDate)));
		const seen = new Set(wods.map((w) => w.id));
		for (const extra of sameDay) if (!seen.has(extra.id)) wods.push(extra);
		nextCursor = lastDate;
	}

	// All sections for the page in one query
	const wodIds = wods.map((w) => w.id);
	const allSections =
		wodIds.length > 0
			? await db
					.select()
					.from(section)
					.where(inArray(section.wodId, wodIds))
					.orderBy(asc(section.order))
			: [];

	const sectionsByWod = new Map<string, (typeof allSections)[number][]>();
	for (const sect of allSections) {
		const list = sectionsByWod.get(sect.wodId);
		if (list) list.push(sect);
		else sectionsByWod.set(sect.wodId, [sect]);
	}

	return json({
		wods: wods.map((w) => serializeWod(w, sectionsByWod.get(w.id) ?? [])),
		nextCursor
	});
};

/**
 * POST /api/wods
 * Creates a WoD with its sections. Coaches and owners only.
 *
 * The device may send its own ids (see entityIdSchema). Creating the same id twice is treated
 * as a replay of a request whose response was lost, and returns the existing WoD.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const d = dictFor(locals.locale);
	if (!locals.user) {
		return json({ error: d.api.unauthorized }, { status: 401 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: d.api.invalidJson }, { status: 400 });
	}

	const validation = createWoDSchema.safeParse(body);
	if (!validation.success) {
		return json(
			{ error: d.api.validationFailed, details: validation.error.flatten() },
			{ status: 400 }
		);
	}

	const data = validation.data;

	const membership = await getMembership(locals.user.id, data.workspaceId);
	if (!membership) {
		return json({ error: d.api.notMember }, { status: 403 });
	}
	if (!canEditWods(membership.role)) {
		return json({ error: d.editor.api.membersCannotCreate }, { status: 403 });
	}

	if (data.id) {
		const [existing] = await db.select().from(wod).where(eq(wod.id, data.id));
		if (existing) {
			if (existing.workspaceId !== data.workspaceId) {
				return json({ error: d.editor.api.alreadyExists }, { status: 409 });
			}
			return json(serializeWod(existing, await getSections(existing.id)));
		}
	}

	const result = await db.transaction(async (tx) => {
		const wodId = data.id ?? generateId();
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

		const rows = await buildSectionRows(tx, wodId, data.sections);
		const createdSections =
			rows.length > 0 ? await tx.insert(section).values(rows).returning() : [];
		createdSections.sort((a, b) => a.order - b.order);

		return serializeWod(newWod, createdSections);
	});

	return json(result, { status: 201 });
};
