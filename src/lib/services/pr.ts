import { browser } from '$app/environment';
import { authFetch } from '$lib/services/auth-fetch';
import {
	cacheExercises,
	getCachedExercises,
	cachePersonalRecords,
	getCachedPersonalRecords,
	cachePersonalRecord,
	deleteCachedPersonalRecord,
	clearCachedPersonalRecords,
	setCacheFlag,
	hasCacheFlag,
	clearCacheFlag
} from '$lib/db/indexeddb';
import { queueOperation } from '$lib/services/sync-queue';
import { syncStore } from '$lib/stores/sync.svelte';
import { toastStore } from '$lib/stores/toast.svelte';
import { generateId } from '$lib/utils';
import type {
	Exercise,
	ExerciseWithBestPR,
	ExerciseCategory,
	MeasurementType
} from '$lib/types/pr';

const EXERCISES_CACHE_KEY = 'exercises-cached';
const PRS_CACHE_KEY = 'prs-cached';

interface CachedExercise {
	id: string;
	name: string;
	category: string;
	measurementType: string;
	sortOrder: number;
}

interface CachedPR {
	id: string;
	exerciseId: string;
	value: number;
	date: string;
	note: string | null;
}

// ============================================================================
// EXERCISES (cached indefinitely)
// ============================================================================

export async function getExercises(): Promise<Exercise[]> {
	if (!browser) return [];

	// Check if exercises are cached
	const isCached = await hasCacheFlag(EXERCISES_CACHE_KEY);

	if (isCached) {
		const cached = await getCachedExercises();
		return cached.map(mapCachedToExercise);
	}

	// Fetch from API
	try {
		const response = await authFetch('/api/exercises');
		if (!response.ok) throw new Error('Failed to fetch exercises');

		const exercises: CachedExercise[] = await response.json();

		// Cache exercises
		await cacheExercises(exercises);
		await setCacheFlag(EXERCISES_CACHE_KEY);

		return exercises.map(mapCachedToExercise);
	} catch (error) {
		console.error('Failed to fetch exercises:', error);
		return [];
	}
}

function mapCachedToExercise(cached: CachedExercise): Exercise {
	return {
		id: cached.id,
		name: cached.name,
		category: cached.category as ExerciseCategory,
		measurementType: cached.measurementType as MeasurementType,
		sortOrder: cached.sortOrder
	};
}

// ============================================================================
// PERSONAL RECORDS (invalidate on write)
// ============================================================================

export async function getUserPRs(): Promise<CachedPR[]> {
	if (!browser) return [];

	// Check if PRs are cached
	const isCached = await hasCacheFlag(PRS_CACHE_KEY);

	if (isCached) {
		return getCachedPersonalRecords();
	}

	// Fetch from API
	try {
		const response = await authFetch('/api/prs');
		if (!response.ok) throw new Error('Failed to fetch PRs');

		const prs: CachedPR[] = await response.json();

		// Cache PRs
		await cachePersonalRecords(prs);
		await setCacheFlag(PRS_CACHE_KEY);

		return prs;
	} catch (error) {
		console.error('Failed to fetch PRs:', error);
		return [];
	}
}

// ============================================================================
// COMBINED (for UI)
// ============================================================================

export async function getExercisesWithPRs(): Promise<ExerciseWithBestPR[]> {
	if (!browser) return [];

	// Fetch exercises and PRs in parallel
	const [exercises, prs] = await Promise.all([getExercises(), getUserPRs()]);

	// Group PRs by exercise and find the best for each
	const prsByExercise = new Map<string, { value: number; date: string }>();

	for (const pr of prs) {
		const ex = exercises.find((e) => e.id === pr.exerciseId);
		if (!ex) continue;

		const existing = prsByExercise.get(pr.exerciseId);
		const isBetter =
			!existing ||
			(ex.measurementType === 'time' ? pr.value < existing.value : pr.value > existing.value);

		if (isBetter) {
			prsByExercise.set(pr.exerciseId, { value: pr.value, date: pr.date });
		}
	}

	// Combine exercises with their best PR
	return exercises.map((ex) => ({
		...ex,
		bestPR: prsByExercise.get(ex.id) ?? null
	}));
}

// ============================================================================
// OFFLINE-AWARE CREATE / DELETE
// ============================================================================

interface CreatePRData {
	exerciseId: string;
	value: number;
	date: string;
	note: string | null;
}

export async function createPR(data: CreatePRData): Promise<boolean> {
	if (!browser) return false;

	// Try online first
	if (syncStore.isOnline) {
		try {
			const response = await authFetch('/api/prs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			if (response.ok) {
				const pr = await response.json();
				await cachePersonalRecord(pr);
				await invalidatePRCache();
				return true;
			}
		} catch {
			// Network error -- fall through to offline path
		}
	}

	// Offline (or online fetch failed): optimistic write + queue sync
	const tempId = generateId();
	const offlinePR = { id: tempId, ...data };
	await cachePersonalRecord(offlinePR);
	await queueOperation({
		type: 'create',
		entity: 'pr',
		entityId: tempId,
		payload: data,
		status: 'pending'
	});
	toastStore.info('PR saved offline -- will sync when back online');
	await invalidatePRCache();
	return true;
}

export async function deletePR(prId: string): Promise<boolean> {
	if (!browser) return false;

	// Try online first
	if (syncStore.isOnline) {
		try {
			const response = await authFetch(`/api/prs/${prId}`, { method: 'DELETE' });
			if (response.ok || response.status === 204) {
				await deleteCachedPersonalRecord(prId);
				await invalidatePRCache();
				return true;
			}
		} catch {
			// Network error -- fall through to offline path
		}
	}

	// Offline (or online fetch failed): optimistic delete + queue sync
	await deleteCachedPersonalRecord(prId);
	await queueOperation({
		type: 'delete',
		entity: 'pr',
		entityId: prId,
		payload: null,
		status: 'pending'
	});
	toastStore.info('PR deleted offline -- will sync when back online');
	await invalidatePRCache();
	return true;
}

// ============================================================================
// CACHE INVALIDATION
// ============================================================================

export async function invalidatePRCache(): Promise<void> {
	if (!browser) return;
	await clearCacheFlag(PRS_CACHE_KEY);
	await clearCachedPersonalRecords();
}

export async function refreshPRCache(): Promise<boolean> {
	if (!browser) return false;

	// Fetch fresh data FIRST, only invalidate cache if fetch succeeds
	// This prevents leaving users with empty cache on network failure
	try {
		const response = await fetch('/api/prs');
		if (!response.ok) {
			if (response.status === 401) return false;
			throw new Error('Failed to fetch PRs');
		}

		const prs: CachedPR[] = await response.json();

		// Only clear and update cache after successful fetch
		await clearCacheFlag(PRS_CACHE_KEY);
		await clearCachedPersonalRecords();
		await cachePersonalRecords(prs);
		await setCacheFlag(PRS_CACHE_KEY);

		return true;
	} catch (error) {
		console.error('Failed to refresh PR cache:', error);
		// Keep existing cache intact on failure
		return false;
	}
}
