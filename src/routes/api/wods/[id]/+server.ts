import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dictFor } from '$lib/i18n';
import { db } from '$lib/server/db';
import { wod, section } from '$lib/server/db/schema';
import { updateWoDSchema } from '$lib/types/wod';
import {
	buildSectionRows,
	canEditWods,
	getSections,
	getWodAccess,
	serializeWod
} from '$lib/server/wods';
import { eq, asc } from 'drizzle-orm';

/**
 * GET /api/wods/[id]
 * Returns the WoD with all its sections. Any member of the workspace.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const d = dictFor(locals.locale);
	if (!locals.user) {
		return json({ error: d.api.unauthorized }, { status: 401 });
	}

	const access = await getWodAccess(locals.user.id, params.id, locals.locale);
	if (!access.ok) {
		return json({ error: access.error }, { status: access.status });
	}

	return json(serializeWod(access.wod, await getSections(params.id)));
};

/**
 * PUT /api/wods/[id]
 * Updates a WoD; when `sections` is sent it replaces them all. Coaches and owners only.
 */
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const d = dictFor(locals.locale);
	if (!locals.user) {
		return json({ error: d.api.unauthorized }, { status: 401 });
	}

	const wodId = params.id;

	const access = await getWodAccess(locals.user.id, wodId, locals.locale);
	if (!access.ok) {
		return json({ error: access.error }, { status: access.status });
	}
	if (!canEditWods(access.membership.role)) {
		return json({ error: d.editor.api.membersCannotEdit }, { status: 403 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: d.api.invalidJson }, { status: 400 });
	}

	const validation = updateWoDSchema.safeParse(body);
	if (!validation.success) {
		return json(
			{ error: d.api.validationFailed, details: validation.error.flatten() },
			{ status: 400 }
		);
	}

	const data = validation.data;

	const result = await db.transaction(async (tx) => {
		const updateData: Partial<typeof wod.$inferInsert> = { updatedAt: new Date() };
		if (data.date !== undefined) updateData.date = data.date;
		if (data.description !== undefined) updateData.description = data.description;

		const [updatedWod] = await tx.update(wod).set(updateData).where(eq(wod.id, wodId)).returning();

		let sections;
		if (data.sections !== undefined) {
			await tx.delete(section).where(eq(section.wodId, wodId));
			const rows = await buildSectionRows(tx, wodId, data.sections);
			sections = rows.length > 0 ? await tx.insert(section).values(rows).returning() : [];
			sections.sort((a, b) => a.order - b.order);
		} else {
			sections = await tx
				.select()
				.from(section)
				.where(eq(section.wodId, wodId))
				.orderBy(asc(section.order));
		}

		return serializeWod(updatedWod, sections);
	});

	return json(result);
};

/**
 * DELETE /api/wods/[id]
 * Deletes a WoD (sections cascade). Coaches and owners only. Returns 204.
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const d = dictFor(locals.locale);
	if (!locals.user) {
		return json({ error: d.api.unauthorized }, { status: 401 });
	}

	const access = await getWodAccess(locals.user.id, params.id, locals.locale);
	if (!access.ok) {
		return json({ error: access.error }, { status: access.status });
	}
	if (!canEditWods(access.membership.role)) {
		return json({ error: d.editor.api.membersCannotDelete }, { status: 403 });
	}

	// SQLite only cascades when foreign keys are enforced on the connection, so delete
	// the sections explicitly instead of relying on it.
	await db.transaction(async (tx) => {
		await tx.delete(section).where(eq(section.wodId, params.id));
		await tx.delete(wod).where(eq(wod.id, params.id));
	});

	return new Response(null, { status: 204 });
};
