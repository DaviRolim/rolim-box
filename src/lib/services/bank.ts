import { browser } from '$app/environment';
import { syncStore } from '$lib/stores/sync.svelte';
import { queueOperation, getUnsyncedEntityIds } from '$lib/services/sync-queue';
import { authFetch } from '$lib/services/auth-fetch';
import {
	cacheBankWod,
	deleteCachedBankWod,
	getCachedBankByWorkspace,
	getCachedBankWod,
	type CachedBankWod
} from '$lib/db/indexeddb';
import { laterDate } from '$lib/bank';
import { generateId } from '$lib/utils';
import type { BankWod, CreateBankWodInput, UpdateBankWodInput } from '$lib/types/bank';
import type { Section, SectionInput, SectionType } from '$lib/types/wod';

/**
 * The WoD bank, local-first, the same way as WoDs (see wod.ts): reads come from IndexedDB,
 * `pull*` reconciles the cache with the server, writes go to the cache and then the sync queue.
 * Screens use the reactive store in `$lib/stores/bank.svelte.ts`.
 */

const ID_PATTERN = /^[0-9a-f]{32}$/;

// ============================================================================
// Read (cache)
// ============================================================================

/** The cached bank of a workspace, newest first. */
export async function readCachedBank(workspaceId: string): Promise<BankWod[]> {
	if (!browser) return [];
	const records = await getCachedBankByWorkspace(workspaceId);
	return records.map(fromRecord).sort(newestFirst);
}

export async function readCachedBankWod(id: string): Promise<BankWod | null> {
	if (!browser) return null;
	const record = await getCachedBankWod(id);
	return record ? fromRecord(record) : null;
}

export function newestFirst(a: BankWod, b: BankWod): number {
	return b.createdAt.getTime() - a.createdAt.getTime();
}

// ============================================================================
// Pull (server -> cache)
// ============================================================================

export type BankPullResult = 'ok' | 'offline' | 'failed' | 'forbidden';

/**
 * Make the cached bank of a workspace match the server, leaving alone anything with a change
 * still waiting to be sent. `force` also overwrites local copies that merely look newer.
 */
export async function pullBank(
	workspaceId: string,
	options: { force?: boolean } = {}
): Promise<BankPullResult> {
	if (!browser) return 'failed';
	if (!syncStore.isOnline) return 'offline';

	try {
		const response = await authFetch(`/api/bank?${new URLSearchParams({ workspaceId })}`);
		syncStore.reportReachable(true);

		if (response.status === 403) {
			// No longer a coach here: nothing of the bank stays on this phone.
			for (const cached of await getCachedBankByWorkspace(workspaceId)) {
				await deleteCachedBankWod(cached.id);
			}
			return 'forbidden';
		}
		if (!response.ok) return 'failed';

		const { items }: { items: ApiBankWod[] } = await response.json();
		const server = items.map(fromApi);
		const unsynced = await getUnsyncedEntityIds();
		const serverIds = new Set(server.map((b) => b.id));

		for (const item of server) {
			if (unsynced.has(item.id)) continue;
			const cached = await getCachedBankWod(item.id);
			if (!options.force && cached && cached.updatedAt > item.updatedAt.getTime()) continue;
			// "Last on" only moves forward; a schedule still on its way to the server is newer.
			item.lastScheduledOn = laterDate(item.lastScheduledOn, cached?.lastScheduledOn ?? null);
			await cacheBankWod(toRecord(item));
		}

		for (const cached of await getCachedBankByWorkspace(workspaceId)) {
			if (serverIds.has(cached.id) || unsynced.has(cached.id)) continue;
			await deleteCachedBankWod(cached.id);
		}

		return 'ok';
	} catch (error) {
		console.warn('Could not refresh the bank from the server:', error);
		syncStore.reportReachable(false);
		return 'failed';
	}
}

/** One bank WoD from the server: the item, `null` when it is not there, or 'failed'. */
export async function pullBankWod(id: string): Promise<BankWod | null | 'failed'> {
	if (!browser || !syncStore.isOnline) return 'failed';

	try {
		const response = await authFetch(`/api/bank/${id}`);
		syncStore.reportReachable(true);

		if (response.status === 404 || response.status === 403) {
			const unsynced = await getUnsyncedEntityIds();
			if (!unsynced.has(id)) await deleteCachedBankWod(id);
			return null;
		}
		if (!response.ok) return 'failed';

		const item = fromApi(await response.json());
		const unsynced = await getUnsyncedEntityIds();
		if (unsynced.has(id)) return (await readCachedBankWod(id)) ?? item;

		await cacheBankWod(toRecord(item));
		return item;
	} catch (error) {
		console.warn('Could not fetch the bank WoD from the server:', error);
		syncStore.reportReachable(false);
		return 'failed';
	}
}

// ============================================================================
// Write (cache first, then queue)
// ============================================================================

export async function createBankWod(data: CreateBankWodInput): Promise<BankWod> {
	if (!browser) throw new Error('createBankWod can only be called in the browser');

	const id = data.id && ID_PATTERN.test(data.id) ? data.id : generateId();
	const now = new Date();
	const item: BankWod = {
		id,
		workspaceId: data.workspaceId,
		name: data.name.trim(),
		description: data.description,
		sections: withIds(id, data.sections),
		lastScheduledOn: data.lastScheduledOn ?? null,
		createdAt: now,
		updatedAt: now
	};

	await cacheBankWod(toRecord(item));
	await queueOperation({
		type: 'create',
		entity: 'bank',
		entityId: id,
		payload: { ...toPayload(item), lastScheduledOn: item.lastScheduledOn },
		status: 'pending'
	});
	return item;
}

export async function updateBankWod(id: string, data: UpdateBankWodInput): Promise<BankWod> {
	if (!browser) throw new Error('updateBankWod can only be called in the browser');

	const existing = await readCachedBankWod(id);
	if (!existing) throw new Error(`Bank WoD ${id} not found`);

	const updated: BankWod = {
		...existing,
		name: data.name?.trim() ?? existing.name,
		description: data.description !== undefined ? data.description : existing.description,
		sections: data.sections ? withIds(id, data.sections) : existing.sections,
		updatedAt: new Date()
	};

	await cacheBankWod(toRecord(updated));
	const { name, description, sections } = toPayload(updated);
	await queueOperation({
		type: 'update',
		entity: 'bank',
		entityId: id,
		payload: { name, description, sections },
		status: 'pending'
	});
	return updated;
}

export async function deleteBankWod(id: string): Promise<void> {
	if (!browser) throw new Error('deleteBankWod can only be called in the browser');

	await deleteCachedBankWod(id);
	await queueOperation({
		type: 'delete',
		entity: 'bank',
		entityId: id,
		payload: { id },
		status: 'pending'
	});
}

/**
 * Record on this phone that a bank WoD was put on `date`. The server records it by itself
 * when the WoD copy arrives (POST /api/wods with `bankWodId`), so nothing is queued here.
 */
export async function markScheduledLocally(id: string, date: string): Promise<BankWod | null> {
	const record = await getCachedBankWod(id);
	if (!record) return null;
	const updated = { ...record, lastScheduledOn: laterDate(record.lastScheduledOn, date) };
	await cacheBankWod(updated);
	return fromRecord(updated);
}

// ============================================================================
// Helpers
// ============================================================================

function withIds(bankWodId: string, sections: SectionInput[]): Section[] {
	const used = new Set<string>();
	return sections.map((section, index) => {
		let id = section.id && ID_PATTERN.test(section.id) && !used.has(section.id) ? section.id : '';
		if (!id) id = generateId();
		used.add(id);
		return {
			id,
			wodId: bankWodId,
			type: section.type,
			name: section.name,
			content: section.content,
			order: index,
			timerConfig: section.timerConfig ?? null
		};
	});
}

function toPayload(item: BankWod) {
	return {
		id: item.id,
		workspaceId: item.workspaceId,
		name: item.name,
		description: item.description,
		sections: item.sections.map((s) => ({
			id: s.id,
			type: s.type,
			name: s.name,
			content: s.content,
			order: s.order,
			timerConfig: s.timerConfig
		}))
	};
}

function toRecord(item: BankWod): CachedBankWod {
	return {
		id: item.id,
		workspaceId: item.workspaceId,
		name: item.name,
		description: item.description,
		sections: item.sections.map((s) => ({
			id: s.id,
			type: s.type,
			name: s.name,
			content: s.content,
			order: s.order,
			timerConfig: s.timerConfig
		})),
		lastScheduledOn: item.lastScheduledOn,
		createdAt: item.createdAt.getTime(),
		updatedAt: item.updatedAt.getTime()
	};
}

function fromRecord(record: CachedBankWod): BankWod {
	return {
		id: record.id,
		workspaceId: record.workspaceId,
		name: record.name,
		description: record.description,
		sections: [...record.sections]
			.sort((a, b) => a.order - b.order)
			.map((s) => ({
				id: s.id,
				wodId: record.id,
				type: s.type as SectionType,
				name: s.name,
				content: s.content,
				order: s.order,
				timerConfig: s.timerConfig
			})),
		lastScheduledOn: record.lastScheduledOn,
		createdAt: new Date(record.createdAt),
		updatedAt: new Date(record.updatedAt)
	};
}

interface ApiBankWod {
	id: string;
	workspaceId: string;
	name: string;
	description: string | null;
	sections?: {
		id: string;
		bankWodId: string;
		type: SectionType;
		name: string;
		content: string;
		order: number;
		timerConfig: string | null;
	}[];
	lastScheduledOn: string | null;
	createdAt: string;
	updatedAt: string;
}

function fromApi(api: ApiBankWod): BankWod {
	return {
		id: api.id,
		workspaceId: api.workspaceId,
		name: api.name,
		description: api.description,
		sections: [...(api.sections ?? [])]
			.sort((a, b) => a.order - b.order)
			.map((s) => ({
				id: s.id,
				wodId: api.id,
				type: s.type,
				name: s.name,
				content: s.content,
				order: s.order,
				timerConfig: s.timerConfig
			})),
		lastScheduledOn: api.lastScheduledOn,
		createdAt: new Date(api.createdAt),
		updatedAt: new Date(api.updatedAt)
	};
}
