import { browser } from '$app/environment';
import { syncStore } from '$lib/stores/sync.svelte';
import { queueOperation, getUnsyncedEntityIds } from '$lib/services/sync-queue';
import { authFetch } from '$lib/services/auth-fetch';
import {
	cacheWod,
	getCachedWod,
	getCachedWodsByWorkspace,
	deleteCachedWod,
	cacheSections,
	getCachedSectionsByWod,
	deleteCachedSectionsByWod
} from '$lib/db/indexeddb';
import { generateId } from '$lib/utils';
import { todayIso } from '$lib/date';
import type { WoD, Section, SectionType, CreateWoDInput, UpdateWoDInput } from '$lib/types/wod';

/**
 * WoD data access, local-first.
 *
 * Reads come from IndexedDB (`readCached*`) so screens render instantly and offline.
 * `pull*` fetches from the server and reconciles the cache. Writes are applied to the cache
 * immediately and queued for the server (see sync-queue.ts).
 *
 * Screens normally go through the reactive store in `$lib/stores/wods.svelte.ts` instead of
 * calling this module directly.
 */

const ID_PATTERN = /^[0-9a-f]{32}$/;

// ============================================================================
// Read (cache)
// ============================================================================

/** All cached WoDs of a workspace, newest date first. */
export async function readCachedWoDs(workspaceId: string): Promise<WoD[]> {
	if (!browser) return [];

	const cached = await getCachedWodsByWorkspace(workspaceId);
	const wods = await Promise.all(cached.map((record) => hydrate(record)));
	return wods.sort(byDateDesc);
}

export async function readCachedWoD(id: string): Promise<WoD | null> {
	if (!browser) return null;
	const record = await getCachedWod(id);
	return record ? hydrate(record) : null;
}

type CachedWodRecord = NonNullable<Awaited<ReturnType<typeof getCachedWod>>>;

async function hydrate(record: CachedWodRecord): Promise<WoD> {
	const sections = await getCachedSectionsByWod(record.id);
	return {
		id: record.id,
		workspaceId: record.workspaceId,
		date: record.date,
		description: record.description,
		sections: sections
			.sort((a, b) => a.order - b.order)
			.map((s) => ({
				id: s.id,
				wodId: s.wodId,
				type: s.type as SectionType,
				name: s.name,
				content: s.content,
				order: s.order,
				timerConfig: s.timerConfig
			})),
		createdAt: new Date(record.createdAt),
		updatedAt: new Date(record.updatedAt)
	};
}

function byDateDesc(a: WoD, b: WoD): number {
	return b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime();
}

// ============================================================================
// Pull (server -> cache)
// ============================================================================

export type PullResult = 'ok' | 'offline' | 'failed';

/**
 * Fetch every WoD of a workspace and make the cache match the server:
 * new and changed WoDs are written, WoDs deleted on the server are removed.
 * Anything with a change still waiting in the sync queue is left alone, because the copy on
 * this device is newer than the server's. `force` also overwrites local copies that merely look
 * newer (used after discarding changes the server refused).
 */
export async function pullWoDs(
	workspaceId: string,
	options: { force?: boolean } = {}
): Promise<PullResult> {
	if (!browser) return 'failed';
	if (!syncStore.isOnline) return 'offline';

	try {
		const serverWods: WoD[] = [];
		let cursor: string | null = null;
		do {
			const params = new URLSearchParams({ workspaceId, limit: '100' });
			if (cursor) params.set('cursor', cursor);

			const response = await authFetch(`/api/wods?${params}`);
			if (!response.ok) {
				syncStore.reportReachable(true);
				return 'failed';
			}

			const page: { wods: ApiWod[]; nextCursor: string | null } = await response.json();
			serverWods.push(...page.wods.map(mapApiWod));
			cursor = page.nextCursor;
		} while (cursor);

		syncStore.reportReachable(true);

		const unsynced = await getUnsyncedEntityIds();
		const serverIds = new Set(serverWods.map((w) => w.id));

		for (const wod of serverWods) {
			if (unsynced.has(wod.id)) continue;
			if (!options.force) {
				// A change that synced a moment ago can be newer than this response.
				const cached = await getCachedWod(wod.id);
				if (cached && cached.updatedAt > wod.updatedAt.getTime()) continue;
			}
			await writeToCache(wod);
		}

		for (const cached of await getCachedWodsByWorkspace(workspaceId)) {
			if (serverIds.has(cached.id) || unsynced.has(cached.id)) continue;
			await deleteCachedSectionsByWod(cached.id);
			await deleteCachedWod(cached.id);
		}

		syncStore.lastSyncedAt = Date.now();
		return 'ok';
	} catch (error) {
		console.warn('Could not refresh WoDs from the server:', error);
		syncStore.reportReachable(false);
		return 'failed';
	}
}

/**
 * Fetch one WoD from the server into the cache.
 * Returns the WoD, `null` when the server says it does not exist (or is not ours to see),
 * or 'failed' when the server could not be asked.
 */
export async function pullWoD(id: string): Promise<WoD | null | 'failed'> {
	if (!browser || !syncStore.isOnline) return 'failed';

	try {
		const response = await authFetch(`/api/wods/${id}`);
		syncStore.reportReachable(true);

		if (response.status === 404 || response.status === 403) {
			const unsynced = await getUnsyncedEntityIds();
			if (!unsynced.has(id)) {
				await deleteCachedSectionsByWod(id);
				await deleteCachedWod(id);
			}
			return null;
		}
		if (!response.ok) return 'failed';

		const wod = mapApiWod(await response.json());
		const unsynced = await getUnsyncedEntityIds();
		if (unsynced.has(id)) return (await readCachedWoD(id)) ?? wod;

		await writeToCache(wod);
		return wod;
	} catch (error) {
		console.warn('Could not fetch the WoD from the server:', error);
		syncStore.reportReachable(false);
		return 'failed';
	}
}

// ============================================================================
// Write (cache first, then queue)
// ============================================================================

/** Create a WoD. The id is generated here and kept by the server. */
export async function createWoD(data: CreateWoDInput): Promise<WoD> {
	if (!browser) throw new Error('createWoD can only be called in the browser');

	const id = data.id && ID_PATTERN.test(data.id) ? data.id : generateId();
	const now = new Date();

	const wod: WoD = {
		id,
		workspaceId: data.workspaceId,
		date: data.date,
		description: data.description,
		sections: withIds(id, data.sections),
		createdAt: now,
		updatedAt: now
	};

	await writeToCache(wod);
	await queueOperation({
		type: 'create',
		entity: 'wod',
		entityId: id,
		payload: toPayload(wod),
		status: 'pending'
	});

	return wod;
}

/** Update a WoD. Sections keep their ids, so timer links stay valid. */
export async function updateWoD(id: string, data: UpdateWoDInput): Promise<WoD> {
	if (!browser) throw new Error('updateWoD can only be called in the browser');

	const existing = await readCachedWoD(id);
	if (!existing) {
		throw new Error(`WoD with id ${id} not found`);
	}

	const updated: WoD = {
		...existing,
		date: data.date ?? existing.date,
		description: data.description !== undefined ? data.description : existing.description,
		sections: data.sections ? withIds(id, data.sections) : existing.sections,
		updatedAt: new Date()
	};

	await writeToCache(updated);
	await queueOperation({
		type: 'update',
		entity: 'wod',
		entityId: id,
		payload: toPayload(updated),
		status: 'pending'
	});

	return updated;
}

export async function deleteWoD(id: string): Promise<void> {
	if (!browser) throw new Error('deleteWoD can only be called in the browser');

	await deleteCachedSectionsByWod(id);
	await deleteCachedWod(id);
	await queueOperation({
		type: 'delete',
		entity: 'wod',
		entityId: id,
		payload: { id },
		status: 'pending'
	});
}

/** Copy a WoD onto another date (today by default). */
export async function duplicateWoD(id: string, newDate?: string): Promise<WoD> {
	if (!browser) throw new Error('duplicateWoD can only be called in the browser');

	const source = await readCachedWoD(id);
	if (!source) {
		throw new Error(`WoD with id ${id} not found`);
	}

	return createWoD({
		workspaceId: source.workspaceId,
		date: newDate ?? todayIso(),
		description: source.description,
		sections: source.sections.map((s) => ({
			type: s.type,
			name: s.name,
			content: s.content,
			order: s.order,
			timerConfig: s.timerConfig
		}))
	});
}

// ============================================================================
// Helpers
// ============================================================================

function withIds(wodId: string, sections: CreateWoDInput['sections']): Section[] {
	const used = new Set<string>();
	return sections.map((section, index) => {
		let id = section.id && ID_PATTERN.test(section.id) && !used.has(section.id) ? section.id : '';
		if (!id) id = generateId();
		used.add(id);
		return {
			id,
			wodId,
			type: section.type,
			name: section.name,
			content: section.content,
			order: index,
			timerConfig: section.timerConfig ?? null
		};
	});
}

function toPayload(wod: WoD) {
	return {
		id: wod.id,
		workspaceId: wod.workspaceId,
		date: wod.date,
		description: wod.description,
		sections: wod.sections.map((s) => ({
			id: s.id,
			type: s.type,
			name: s.name,
			content: s.content,
			order: s.order,
			timerConfig: s.timerConfig
		}))
	};
}

async function writeToCache(wod: WoD): Promise<void> {
	await deleteCachedSectionsByWod(wod.id);
	await cacheWod({
		id: wod.id,
		workspaceId: wod.workspaceId,
		date: wod.date,
		description: wod.description,
		createdAt: wod.createdAt.getTime(),
		updatedAt: wod.updatedAt.getTime()
	});
	if (wod.sections.length > 0) {
		await cacheSections(
			wod.sections.map((s) => ({
				id: s.id,
				wodId: s.wodId,
				type: s.type,
				name: s.name,
				content: s.content,
				order: s.order,
				timerConfig: s.timerConfig
			}))
		);
	}
}

interface ApiSection {
	id: string;
	wodId: string;
	type: SectionType;
	name: string;
	content: string;
	order: number;
	timerConfig: string | null;
}

interface ApiWod {
	id: string;
	workspaceId: string;
	date: string;
	description: string | null;
	sections?: ApiSection[];
	createdAt: string;
	updatedAt: string;
}

function mapApiWod(api: ApiWod): WoD {
	return {
		id: api.id,
		workspaceId: api.workspaceId,
		date: api.date,
		description: api.description,
		sections: [...(api.sections ?? [])]
			.sort((a, b) => a.order - b.order)
			.map((s) => ({
				id: s.id,
				wodId: s.wodId,
				type: s.type,
				name: s.name,
				content: s.content,
				order: s.order,
				timerConfig: s.timerConfig
			})),
		createdAt: new Date(api.createdAt),
		updatedAt: new Date(api.updatedAt)
	};
}
