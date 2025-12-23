import { browser } from '$app/environment';
import { syncStore } from '$lib/stores/sync.svelte';
import { queueOperation, processQueue } from '$lib/services/sync-queue';
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
import type { WoD, Section, CreateWoDInput, UpdateWoDInput } from '$lib/types/wod';

// ============================================================================
// Read Operations (Cache-First)
// ============================================================================

/**
 * List all WoDs for a workspace
 * Returns cached data immediately, fetches fresh data in background if online
 */
export async function listWoDs(workspaceId: string): Promise<WoD[]> {
	if (!browser) return [];

	// 1. Get cached WoDs
	const cachedWods = await getCachedWodsByWorkspace(workspaceId);

	// 2. For each cached WoD, get its sections
	const wodsWithSections = await Promise.all(
		cachedWods.map(async (wodData) => {
			const sections = await getCachedSectionsByWod(wodData.id);
			return {
				id: wodData.id,
				workspaceId: wodData.workspaceId,
				date: wodData.date,
				description: wodData.description,
				sections: sections
					.sort((a, b) => a.order - b.order)
					.map((s) => ({
						id: s.id,
						wodId: s.wodId,
						type: s.type as WoD['sections'][0]['type'],
						name: s.name,
						content: s.content,
						order: s.order,
						timerConfig: s.timerConfig
					})),
				createdAt: new Date(wodData.createdAt),
				updatedAt: new Date(wodData.updatedAt)
			} as WoD;
		})
	);

	// 3. If online, fetch fresh data in background and update cache
	if (syncStore.isOnline) {
		fetchAndUpdateCache(workspaceId).catch((error) => {
			console.error('Background fetch failed:', error);
		});
	}

	// 4. Sort by date DESC (newest first)
	return wodsWithSections.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get a single WoD by ID
 * Checks cache first, then API if online
 */
export async function getWoD(id: string): Promise<WoD | null> {
	if (!browser) return null;

	// 1. Check cache first
	const cachedWod = await getCachedWod(id);

	if (cachedWod) {
		const sections = await getCachedSectionsByWod(id);
		const wod: WoD = {
			id: cachedWod.id,
			workspaceId: cachedWod.workspaceId,
			date: cachedWod.date,
			description: cachedWod.description,
			sections: sections
				.sort((a, b) => a.order - b.order)
				.map((s) => ({
					id: s.id,
					wodId: s.wodId,
					type: s.type as WoD['sections'][0]['type'],
					name: s.name,
					content: s.content,
					order: s.order,
					timerConfig: s.timerConfig
				})),
			createdAt: new Date(cachedWod.createdAt),
			updatedAt: new Date(cachedWod.updatedAt)
		};

		// 2. If online, fetch fresh data in background
		if (syncStore.isOnline) {
			fetchSingleWoDAndUpdateCache(id).catch((error) => {
				console.error('Background fetch failed:', error);
			});
		}

		return wod;
	}

	// 3. If not in cache and online, fetch from API
	if (syncStore.isOnline) {
		try {
			const response = await fetch(`/api/wods/${id}`);
			if (response.ok) {
				const wod = await response.json();

				// Cache the fetched data
				await cacheWodWithSections(mapApiWoDToWoD(wod));

				return mapApiWoDToWoD(wod);
			}
		} catch (error) {
			console.error('Failed to fetch WoD from API:', error);
		}
	}

	return null;
}

/**
 * Background fetch to update cache with fresh data from API
 */
async function fetchAndUpdateCache(workspaceId: string): Promise<void> {
	try {
		const response = await fetch(`/api/wods?workspaceId=${workspaceId}`);
		if (response.ok) {
			const wods = await response.json();

			// Update cache with fresh data
			for (const wod of wods.map(mapApiWoDToWoD)) {
				// Delete old sections first to prevent duplication
				await deleteCachedSectionsByWod(wod.id);
				await cacheWodWithSections(wod);
			}
		}
	} catch (error) {
		console.error('Failed to fetch WoDs from API:', error);
	}
}

/**
 * Background fetch for a single WoD
 */
async function fetchSingleWoDAndUpdateCache(id: string): Promise<void> {
	try {
		const response = await fetch(`/api/wods/${id}`);
		if (response.ok) {
			const wod = await response.json();

			// Delete old sections first to prevent duplication
			await deleteCachedSectionsByWod(id);
			// Update cache with fresh data
			await cacheWodWithSections(mapApiWoDToWoD(wod));
		}
	} catch (error) {
		console.error('Failed to fetch WoD from API:', error);
	}
}

// ============================================================================
// Write Operations (Optimistic)
// ============================================================================

/**
 * Create a new WoD
 * Generates ID client-side, saves to IndexedDB immediately, queues sync
 */
export async function createWoD(data: CreateWoDInput): Promise<WoD> {
	if (!browser) throw new Error('createWoD can only be called in the browser');

	// 1. Generate ID client-side
	const id = generateId();
	const now = Date.now();

	// 2. Generate IDs for each section
	const sectionsWithIds: Section[] = data.sections.map((section, index) => ({
		id: generateId(),
		wodId: id,
		type: section.type,
		name: section.name,
		content: section.content,
		order: section.order ?? index,
		timerConfig: section.timerConfig ?? null
	}));

	// 3. Create WoD object
	const wod: WoD = {
		id,
		workspaceId: data.workspaceId,
		date: data.date,
		description: data.description,
		sections: sectionsWithIds,
		createdAt: new Date(now),
		updatedAt: new Date(now)
	};

	// 4. Save to IndexedDB immediately
	await cacheWodWithSections(wod);

	// 5. Queue sync operation
	await queueOperation({
		type: 'create',
		entity: 'wod',
		entityId: id,
		payload: {
			id,
			workspaceId: data.workspaceId,
			date: data.date,
			description: data.description,
			sections: sectionsWithIds.map((s) => ({
				id: s.id,
				type: s.type,
				name: s.name,
				content: s.content,
				order: s.order,
				timerConfig: s.timerConfig
			}))
		},
		status: 'pending'
	});

	// 6. If online, trigger queue processing
	if (syncStore.isOnline) {
		processQueue();
	}

	return wod;
}

/**
 * Update an existing WoD
 * Updates IndexedDB immediately, queues sync
 */
export async function updateWoD(id: string, data: UpdateWoDInput): Promise<WoD> {
	if (!browser) throw new Error('updateWoD can only be called in the browser');

	// 1. Get existing WoD from cache
	const existingWod = await getWoD(id);
	if (!existingWod) {
		throw new Error(`WoD with id ${id} not found`);
	}

	// 2. Generate IDs for new sections (if sections are being updated)
	let sectionsWithIds: Section[] = existingWod.sections;
	if (data.sections) {
		sectionsWithIds = data.sections.map((section, index) => ({
			id: generateId(),
			wodId: id,
			type: section.type,
			name: section.name,
			content: section.content,
			order: section.order ?? index,
			timerConfig: (section as any).timerConfig ?? null
		}));
	}

	// 3. Create updated WoD object
	const updatedWod: WoD = {
		...existingWod,
		date: data.date ?? existingWod.date,
		description: data.description !== undefined ? data.description : existingWod.description,
		sections: sectionsWithIds,
		updatedAt: new Date()
	};

	// 4. Update IndexedDB immediately
	// Delete old sections first
	await deleteCachedSectionsByWod(id);
	// Save updated WoD with new sections
	await cacheWodWithSections(updatedWod);

	// 5. Queue sync operation
	await queueOperation({
		type: 'update',
		entity: 'wod',
		entityId: id,
		payload: {
			id,
			workspaceId: updatedWod.workspaceId,
			date: updatedWod.date,
			description: updatedWod.description,
			sections: sectionsWithIds.map((s) => ({
				id: s.id,
				type: s.type,
				name: s.name,
				content: s.content,
				order: s.order,
				timerConfig: s.timerConfig
			}))
		},
		status: 'pending'
	});

	// 6. If online, trigger queue processing
	if (syncStore.isOnline) {
		processQueue();
	}

	return updatedWod;
}

/**
 * Delete a WoD
 * Deletes from IndexedDB immediately, queues sync
 */
export async function deleteWoD(id: string): Promise<void> {
	if (!browser) throw new Error('deleteWoD can only be called in the browser');

	// 1. Delete from IndexedDB immediately
	await deleteCachedSectionsByWod(id);
	await deleteCachedWod(id);

	// 2. Queue sync operation
	await queueOperation({
		type: 'delete',
		entity: 'wod',
		entityId: id,
		payload: { id },
		status: 'pending'
	});

	// 3. If online, trigger queue processing
	if (syncStore.isOnline) {
		processQueue();
	}
}

/**
 * Duplicate a WoD with a new date
 * Creates a copy with new IDs, queues sync
 */
export async function duplicateWoD(id: string, newDate?: string): Promise<WoD> {
	if (!browser) throw new Error('duplicateWoD can only be called in the browser');

	// 1. Get existing WoD from cache
	const existingWod = await getWoD(id);
	if (!existingWod) {
		throw new Error(`WoD with id ${id} not found`);
	}

	// 2. Generate new ID for the duplicate
	const newId = generateId();
	const now = Date.now();

	// 3. Use provided date or today's date
	const date = newDate ?? new Date().toISOString().split('T')[0];

	// 4. Generate new IDs for sections
	const sectionsWithNewIds: Section[] = existingWod.sections.map((section) => ({
		...section,
		id: generateId(),
		wodId: newId
	}));

	// 5. Create duplicated WoD object
	const duplicatedWod: WoD = {
		...existingWod,
		id: newId,
		date,
		sections: sectionsWithNewIds,
		createdAt: new Date(now),
		updatedAt: new Date(now)
	};

	// 6. Save to IndexedDB immediately
	await cacheWodWithSections(duplicatedWod);

	// 7. Queue sync operation
	await queueOperation({
		type: 'create',
		entity: 'wod',
		entityId: newId,
		payload: {
			id: newId,
			workspaceId: duplicatedWod.workspaceId,
			date: duplicatedWod.date,
			description: duplicatedWod.description,
			sections: sectionsWithNewIds.map((s) => ({
				id: s.id,
				type: s.type,
				name: s.name,
				content: s.content,
				order: s.order,
				timerConfig: s.timerConfig
			}))
		},
		status: 'pending'
	});

	// 8. If online, trigger queue processing
	if (syncStore.isOnline) {
		processQueue();
	}

	return duplicatedWod;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Cache a WoD with its sections in IndexedDB
 */
async function cacheWodWithSections(wod: WoD): Promise<void> {
	// Cache WoD metadata
	await cacheWod({
		id: wod.id,
		workspaceId: wod.workspaceId,
		date: wod.date,
		description: wod.description,
		createdAt: wod.createdAt.getTime(),
		updatedAt: wod.updatedAt.getTime()
	});

	// Cache sections
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

/**
 * Map API response to WoD type
 * Handles conversion of dates and ensures proper typing
 */
function mapApiWoDToWoD(apiWod: any): WoD {
	return {
		id: apiWod.id,
		workspaceId: apiWod.workspaceId,
		date: apiWod.date,
		description: apiWod.description,
		sections: (apiWod.sections || [])
			.sort((a: any, b: any) => a.order - b.order)
			.map((s: any) => ({
				id: s.id,
				wodId: s.wodId,
				type: s.type,
				name: s.name,
				content: s.content,
				order: s.order,
				timerConfig: s.timerConfig
			})),
		createdAt: new Date(apiWod.createdAt),
		updatedAt: new Date(apiWod.updatedAt)
	};
}
