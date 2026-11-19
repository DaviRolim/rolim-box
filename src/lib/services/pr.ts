import { browser } from '$app/environment';
import { authFetch } from '$lib/services/auth-fetch';
import { t } from '$lib/i18n';
import {
	cacheExercises,
	getCachedExercises,
	cachePersonalRecords,
	getCachedPersonalRecords,
	cachePersonalRecord,
	deleteCachedPersonalRecord,
	setCacheFlag,
	hasCacheFlag,
	clearCacheFlag,
	type CachedPR
} from '$lib/db/indexeddb';
import { getQueuedOperations, queueOperation } from '$lib/services/sync-queue';
import { syncStore } from '$lib/stores/sync.svelte';
import { toastStore } from '$lib/stores/toast.svelte';
import { generateId } from '$lib/utils';
import {
	createPRSchema,
	prVideoUrlSchema,
	type Exercise,
	type ExerciseWithBestPR,
	type ExerciseCategory,
	type MeasurementType,
	type CreatePRInput
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
// PERSONAL RECORDS
// ============================================================================

export async function getUserPRs(): Promise<CachedPR[]> {
	if (!browser) return [];

	// Check if PRs are cached
	const isCached = await hasCacheFlag(PRS_CACHE_KEY);

	if (isCached || !syncStore.isOnline) {
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
	} catch (error) {
		console.error('Failed to fetch PRs:', error);
	}
	return getCachedPersonalRecords();
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
// OFFLINE-AWARE WRITES
// ============================================================================

export async function createPR(input: Omit<CreatePRInput, 'id'>): Promise<boolean> {
	if (!browser) return false;

	const validation = createPRSchema.safeParse(input);
	if (!validation.success) return false;
	const { id = generateId(), ...data } = validation.data;

	// Try online first
	if (syncStore.isOnline) {
		const response = await authFetch('/api/prs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, ...data })
		}).catch(() => null);
		if (response?.ok) {
			await cachePersonalRecord(await response.json());
			return true;
		}
		if (response && response.status < 500 && response.status !== 408 && response.status !== 429)
			return false;
	}

	await queueOperation(
		{ type: 'create', entity: 'pr', entityId: id, payload: data, status: 'pending' },
		{ id, ...data, note: data.note ?? null, videoUrl: data.videoUrl ?? null }
	);
	toastStore.info(t.prs.savedOffline);
	return true;
}

export async function updatePRVideo(pr: CachedPR, videoUrl: string | null): Promise<boolean> {
	if (!browser) return false;
	const validation = prVideoUrlSchema.safeParse(videoUrl);
	if (!validation.success) return false;

	await queueOperation(
		{
			type: 'update',
			entity: 'pr',
			entityId: pr.id,
			payload: { videoUrl: validation.data },
			status: 'pending'
		},
		{ ...pr, videoUrl: validation.data }
	);
	return true;
}

export async function deletePR(prId: string): Promise<boolean> {
	if (!browser) return false;

	const queued = await getQueuedOperations();
	const hasPendingChange = queued.some(
		(op) => op.entity === 'pr' && op.entityId === prId && op.status === 'pending'
	);
	if (syncStore.isOnline && !hasPendingChange) {
		const response = await authFetch(`/api/prs/${prId}`, { method: 'DELETE' }).catch(() => null);
		if (response?.ok || response?.status === 404) {
			await deleteCachedPersonalRecord(prId);
			return true;
		}
		if (response && response.status < 500 && response.status !== 408 && response.status !== 429)
			return false;
	}

	await queueOperation(
		{ type: 'delete', entity: 'pr', entityId: prId, payload: null, status: 'pending' },
		null
	);
	toastStore.info(t.prs.deletedOffline);
	return true;
}

// ============================================================================
// CACHE INVALIDATION
// ============================================================================

export async function invalidatePRCache(): Promise<void> {
	if (!browser) return;
	await clearCacheFlag(PRS_CACHE_KEY);
}

/**
 * Re-read the person's PRs from the server, so records saved on another device show up here.
 * The cached list is kept if the request fails, and PRs saved offline on this device that have
 * not reached the server yet stay in it (and ones deleted offline stay out).
 */
export async function refreshPRCache(): Promise<boolean> {
	if (!browser) return false;

	try {
		const response = await fetch('/api/prs');
		if (!response.ok) {
			if (response.status === 401) return false;
			throw new Error('Failed to fetch PRs');
		}

		await cachePersonalRecords(await response.json());
		await setCacheFlag(PRS_CACHE_KEY);

		return true;
	} catch (error) {
		console.error('Failed to refresh PR cache:', error);
		return false;
	}
}
