import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { section, wod, workspaceMember } from '$lib/server/db/schema';
import { generateId } from '$lib/server/auth';
import type { SectionInput } from '$lib/types/wod';

export type WorkspaceRole = 'owner' | 'coach' | 'member';

/** Owners and coaches program the box; members (athletes) read. */
export function canEditWods(role: string | undefined | null): boolean {
	return role === 'owner' || role === 'coach';
}

export async function getMembership(userId: string, workspaceId: string) {
	const [membership] = await db
		.select()
		.from(workspaceMember)
		.where(and(eq(workspaceMember.userId, userId), eq(workspaceMember.workspaceId, workspaceId)));
	return membership ?? null;
}

type WodAccess =
	| { ok: true; wod: typeof wod.$inferSelect; membership: typeof workspaceMember.$inferSelect }
	| { ok: false; status: 403 | 404; error: string };

/** Load a WoD and check the user belongs to its workspace. */
export async function getWodAccess(userId: string, wodId: string): Promise<WodAccess> {
	const [wodRecord] = await db.select().from(wod).where(eq(wod.id, wodId));
	if (!wodRecord) return { ok: false, status: 404, error: 'WoD not found' };

	const membership = await getMembership(userId, wodRecord.workspaceId);
	if (!membership) {
		return { ok: false, status: 403, error: 'Access denied: not a member of this workspace' };
	}

	return { ok: true, wod: wodRecord, membership };
}

export async function getSections(wodId: string) {
	return db.select().from(section).where(eq(section.wodId, wodId)).orderBy(asc(section.order));
}

export function serializeWod(
	wodRecord: typeof wod.$inferSelect,
	sections: (typeof section.$inferSelect)[]
) {
	return {
		id: wodRecord.id,
		workspaceId: wodRecord.workspaceId,
		date: wodRecord.date,
		description: wodRecord.description,
		sections,
		createdAt: wodRecord.createdAt,
		updatedAt: wodRecord.updatedAt
	};
}

/**
 * Build section rows for a WoD, keeping the ids the device generated whenever they are free.
 * An id already used by a section of another WoD (or repeated in the payload) gets a fresh one,
 * so a bad or replayed payload can never fail the whole write.
 * Call this after the WoD's own previous sections have been deleted.
 */
export async function buildSectionRows(
	tx: Pick<typeof db, 'select'>,
	wodId: string,
	sections: SectionInput[]
): Promise<(typeof section.$inferInsert)[]> {
	const requested = sections.map((s) => s.id).filter((id): id is string => !!id);
	const taken = new Set<string>();
	if (requested.length > 0) {
		const rows = await tx
			.select({ id: section.id })
			.from(section)
			.where(inArray(section.id, requested));
		for (const row of rows) taken.add(row.id);
	}

	return sections.map((s) => {
		const id = s.id && !taken.has(s.id) ? s.id : generateId();
		taken.add(id);
		return {
			id,
			wodId,
			type: s.type,
			name: s.name,
			content: s.content,
			order: s.order,
			timerConfig: s.timerConfig ?? null
		};
	});
}
