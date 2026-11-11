import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { dictFor } from '$lib/i18n';
import { db } from '$lib/server/db';
import { bankSection, bankWod } from '$lib/server/db/schema';
import { generateId } from '$lib/server/auth';
import {
	buildBankSectionRows,
	getBankSections,
	getBankWorkspaceAccess,
	serializeBankWod
} from '$lib/server/bank';
import { createBankWodSchema } from '$lib/types/bank';

/**
 * GET /api/bank?workspaceId={id}
 * Every bank WoD of the workspace, newest first, with its sections. Coaches and owners only.
 * The bank is a short list a coach keeps by hand, so it is not paginated.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const d = dictFor(locals.locale);
	if (!locals.user) {
		return json({ error: d.api.unauthorized }, { status: 401 });
	}

	const workspaceId = url.searchParams.get('workspaceId');
	if (!workspaceId) {
		return json({ error: d.api.workspaceRequired }, { status: 400 });
	}

	const access = await getBankWorkspaceAccess(locals.user.id, workspaceId, locals.locale);
	if (!access.ok) {
		return json({ error: access.error }, { status: access.status });
	}

	const items = await db
		.select()
		.from(bankWod)
		.where(eq(bankWod.workspaceId, workspaceId))
		.orderBy(desc(bankWod.createdAt));

	const ids = items.map((item) => item.id);
	const sections =
		ids.length > 0
			? await db
					.select()
					.from(bankSection)
					.where(inArray(bankSection.bankWodId, ids))
					.orderBy(asc(bankSection.order))
			: [];

	const byWod = new Map<string, (typeof sections)[number][]>();
	for (const s of sections) {
		const list = byWod.get(s.bankWodId);
		if (list) list.push(s);
		else byWod.set(s.bankWodId, [s]);
	}

	return json({ items: items.map((item) => serializeBankWod(item, byWod.get(item.id) ?? [])) });
};

/**
 * POST /api/bank
 * Saves a WoD into the bank. Coaches and owners only.
 * Like POST /api/wods, the device may send its own id; the same id twice is a replay and
 * returns what was saved the first time.
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

	const validation = createBankWodSchema.safeParse(body);
	if (!validation.success) {
		return json(
			{ error: d.api.validationFailed, details: validation.error.flatten() },
			{ status: 400 }
		);
	}
	const data = validation.data;

	const access = await getBankWorkspaceAccess(locals.user.id, data.workspaceId, locals.locale);
	if (!access.ok) {
		return json({ error: access.error }, { status: access.status });
	}

	if (data.id) {
		const [existing] = await db.select().from(bankWod).where(eq(bankWod.id, data.id));
		if (existing) {
			if (existing.workspaceId !== data.workspaceId) {
				return json({ error: d.bank.api.alreadyExists }, { status: 409 });
			}
			return json(serializeBankWod(existing, await getBankSections(existing.id)));
		}
	}

	const result = await db.transaction(async (tx) => {
		const id = data.id ?? generateId();
		const now = new Date();

		const [created] = await tx
			.insert(bankWod)
			.values({
				id,
				workspaceId: data.workspaceId,
				name: data.name,
				description: data.description,
				lastScheduledOn: data.lastScheduledOn ?? null,
				createdAt: now,
				updatedAt: now
			})
			.returning();

		const rows = await buildBankSectionRows(tx, id, data.sections);
		const sections = rows.length > 0 ? await tx.insert(bankSection).values(rows).returning() : [];
		sections.sort((a, b) => a.order - b.order);

		return serializeBankWod(created, sections);
	});

	return json(result, { status: 201 });
};
