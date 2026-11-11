import { and, asc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bankSection, bankWod, type workspaceMember } from '$lib/server/db/schema';
import { generateId } from '$lib/server/auth';
import { canEditWods, getMembership } from '$lib/server/wods';
import type { SectionInput } from '$lib/types/wod';
import { dictFor, type Locale } from '$lib/i18n';

/**
 * The WoD bank on the server. It is a coach tool: owners and coaches read and write it,
 * athletes get a 403 even for reading.
 */

type Membership = typeof workspaceMember.$inferSelect;
type Denied = { ok: false; status: 403 | 404; error: string };

/** Check the user coaches in the workspace. Errors are in `locale`. */
export async function getBankWorkspaceAccess(
	userId: string,
	workspaceId: string,
	locale: Locale
): Promise<{ ok: true; membership: Membership } | Denied> {
	const d = dictFor(locale);
	const membership = await getMembership(userId, workspaceId);
	if (!membership) return { ok: false, status: 403, error: d.api.notMember };
	if (!canEditWods(membership.role)) {
		return { ok: false, status: 403, error: d.bank.api.coachesOnly };
	}
	return { ok: true, membership };
}

/** Load a bank WoD and check the user coaches in its workspace. */
export async function getBankWodAccess(
	userId: string,
	bankWodId: string,
	locale: Locale
): Promise<{ ok: true; bankWod: typeof bankWod.$inferSelect } | Denied> {
	const [record] = await db.select().from(bankWod).where(eq(bankWod.id, bankWodId));
	if (!record) return { ok: false, status: 404, error: dictFor(locale).bank.api.notFound };

	const access = await getBankWorkspaceAccess(userId, record.workspaceId, locale);
	if (!access.ok) return access;
	return { ok: true, bankWod: record };
}

export async function getBankSections(bankWodId: string) {
	return db
		.select()
		.from(bankSection)
		.where(eq(bankSection.bankWodId, bankWodId))
		.orderBy(asc(bankSection.order));
}

export function serializeBankWod(
	record: typeof bankWod.$inferSelect,
	sections: (typeof bankSection.$inferSelect)[]
) {
	return {
		id: record.id,
		workspaceId: record.workspaceId,
		name: record.name,
		description: record.description,
		sections,
		lastScheduledOn: record.lastScheduledOn,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt
	};
}

/**
 * Section rows for a bank WoD, keeping the device's ids when they are free (see
 * buildSectionRows in wods.ts). Call after the bank WoD's own previous sections are deleted.
 */
export async function buildBankSectionRows(
	tx: Pick<typeof db, 'select'>,
	bankWodId: string,
	sections: SectionInput[]
): Promise<(typeof bankSection.$inferInsert)[]> {
	const requested = sections.map((s) => s.id).filter((id): id is string => !!id);
	const taken = new Set<string>();
	if (requested.length > 0) {
		const rows = await tx
			.select({ id: bankSection.id })
			.from(bankSection)
			.where(inArray(bankSection.id, requested));
		for (const row of rows) taken.add(row.id);
	}

	return sections.map((s) => {
		const id = s.id && !taken.has(s.id) ? s.id : generateId();
		taken.add(id);
		return {
			id,
			bankWodId,
			type: s.type,
			name: s.name,
			content: s.content,
			order: s.order,
			timerConfig: s.timerConfig ?? null
		};
	});
}

/**
 * Remember that a bank WoD was put on `date`. Keeps the latest date, so replaying the same
 * request, or scheduling it onto an earlier day as well, never moves it backwards.
 * A bank WoD from another workspace (or one that is gone) is left alone.
 */
export async function markBankWodScheduled(
	tx: Pick<typeof db, 'update'>,
	bankWodId: string,
	workspaceId: string,
	date: string
): Promise<void> {
	await tx
		.update(bankWod)
		.set({ lastScheduledOn: date })
		.where(
			and(
				eq(bankWod.id, bankWodId),
				eq(bankWod.workspaceId, workspaceId),
				or(isNull(bankWod.lastScheduledOn), lt(bankWod.lastScheduledOn, date))
			)
		);
}
