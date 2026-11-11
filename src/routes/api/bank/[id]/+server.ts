import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { asc, eq } from 'drizzle-orm';
import { dictFor } from '$lib/i18n';
import { db } from '$lib/server/db';
import { bankSection, bankWod } from '$lib/server/db/schema';
import {
	buildBankSectionRows,
	getBankSections,
	getBankWodAccess,
	serializeBankWod
} from '$lib/server/bank';
import { updateBankWodSchema } from '$lib/types/bank';

/** GET /api/bank/[id]: one bank WoD with its sections. Coaches and owners only. */
export const GET: RequestHandler = async ({ locals, params }) => {
	const d = dictFor(locals.locale);
	if (!locals.user) {
		return json({ error: d.api.unauthorized }, { status: 401 });
	}

	const access = await getBankWodAccess(locals.user.id, params.id, locals.locale);
	if (!access.ok) {
		return json({ error: access.error }, { status: access.status });
	}

	return json(serializeBankWod(access.bankWod, await getBankSections(params.id)));
};

/**
 * PUT /api/bank/[id]: change a bank WoD; when `sections` is sent it replaces them all.
 * Coaches and owners only.
 */
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const d = dictFor(locals.locale);
	if (!locals.user) {
		return json({ error: d.api.unauthorized }, { status: 401 });
	}

	const access = await getBankWodAccess(locals.user.id, params.id, locals.locale);
	if (!access.ok) {
		return json({ error: access.error }, { status: access.status });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: d.api.invalidJson }, { status: 400 });
	}

	const validation = updateBankWodSchema.safeParse(body);
	if (!validation.success) {
		return json(
			{ error: d.api.validationFailed, details: validation.error.flatten() },
			{ status: 400 }
		);
	}
	const data = validation.data;
	const id = params.id;

	const result = await db.transaction(async (tx) => {
		const changes: Partial<typeof bankWod.$inferInsert> = { updatedAt: new Date() };
		if (data.name !== undefined) changes.name = data.name;
		if (data.description !== undefined) changes.description = data.description;

		const [updated] = await tx.update(bankWod).set(changes).where(eq(bankWod.id, id)).returning();

		let sections;
		if (data.sections !== undefined) {
			await tx.delete(bankSection).where(eq(bankSection.bankWodId, id));
			const rows = await buildBankSectionRows(tx, id, data.sections);
			sections = rows.length > 0 ? await tx.insert(bankSection).values(rows).returning() : [];
			sections.sort((a, b) => a.order - b.order);
		} else {
			sections = await tx
				.select()
				.from(bankSection)
				.where(eq(bankSection.bankWodId, id))
				.orderBy(asc(bankSection.order));
		}

		return serializeBankWod(updated, sections);
	});

	return json(result);
};

/**
 * DELETE /api/bank/[id]: take a WoD out of the bank. WoDs already put on a day are copies and
 * stay where they are. Coaches and owners only. Returns 204.
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const d = dictFor(locals.locale);
	if (!locals.user) {
		return json({ error: d.api.unauthorized }, { status: 401 });
	}

	const access = await getBankWodAccess(locals.user.id, params.id, locals.locale);
	if (!access.ok) {
		return json({ error: access.error }, { status: access.status });
	}

	await db.transaction(async (tx) => {
		await tx.delete(bankSection).where(eq(bankSection.bankWodId, params.id));
		await tx.delete(bankWod).where(eq(bankWod.id, params.id));
	});

	return new Response(null, { status: 204 });
};
