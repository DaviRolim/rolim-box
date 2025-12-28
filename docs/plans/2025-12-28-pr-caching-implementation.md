# PR Tab Caching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add IndexedDB caching to the PR tab to eliminate redundant server requests on navigation.

**Architecture:** Cache-first reads for exercises (indefinite) and PRs (invalidate-on-write). Client-side service layer fetches from IndexedDB first, falls back to API, then caches. No offline write support - writes go directly to server.

**Tech Stack:** SvelteKit, IndexedDB (via `idb`), Svelte 5 runes, TypeScript, Drizzle ORM

**Design Doc:** `docs/plans/2025-12-28-pr-caching-design.md`

---

## Task 1: Extend IndexedDB Schema

**Files:**
- Modify: `src/lib/db/indexeddb.ts`

**Step 1: Add exercises and personalRecords types to RolimBoxDB interface**

Add after line 58 (after `syncQueue` definition), before the closing brace:

```typescript
	exercises: {
		key: string;
		value: {
			id: string;
			name: string;
			category: string;
			measurementType: string;
			sortOrder: number;
		};
		indexes: {
			'by-category': string;
		};
	};
	personalRecords: {
		key: string;
		value: {
			id: string visually: odId
			odxerciseId: string;
			value: number;
			date: string;
			note: string | null;
		};
		indexes: {
			'by-exercise': string;
		};
	};
```

**Step 2: Bump database version**

Change line 62 from:
```typescript
const DB_VERSION = 2;
```
To:
```typescript
const DB_VERSION = 3;
```

**Step 3: Add store creation in upgrade function**

Add after line 96 (after syncQueue store creation), inside the `upgrade` function:

```typescript
				// Exercises store
				if (!db.objectStoreNames.contains('exercises')) {
					const exerciseStore = db.createObjectStore('exercises', { keyPath: 'id' });
					exerciseStore.createIndex('by-category', 'category');
				}

				// Personal Records store
				if (!db.objectStoreNames.contains('personalRecords')) {
					const prStore = db.createObjectStore('personalRecords', { keyPath: 'id' });
					prStore.createIndex('by-exercise', 'exerciseId');
				}
```

**Step 4: Add exercise cache operations**

Add after line 136 (after `clearCachedWods`):

```typescript
// Exercise operations
export async function cacheExercises(exercises: RolimBoxDB['exercises']['value'][]): Promise<void> {
	const db = await getDB();
	const tx = db.transaction('exercises', 'readwrite');
	await Promise.all([...exercises.map((ex) => tx.store.put(ex)), tx.done]);
}

export async function getCachedExercises(): Promise<RolimBoxDB['exercises']['value'][]> {
	const db = await getDB();
	return db.getAll('exercises');
}

export async function clearCachedExercises(): Promise<void> {
	const db = await getDB();
	await db.clear('exercises');
}
```

**Step 5: Add personal record cache operations**

Add after exercise operations:

```typescript
// Personal Record operations
export async function cachePersonalRecords(prs: RolimBoxDB['personalRecords']['value'][]): Promise<void> {
	const db = await getDB();
	const tx = db.transaction('personalRecords', 'readwrite');
	await Promise.all([...prs.map((pr) => tx.store.put(pr)), tx.done]);
}

export async function getCachedPersonalRecords(): Promise<RolimBoxDB['personalRecords']['value'][]> {
	const db = await getDB();
	return db.getAll('personalRecords');
}

export async function cachePersonalRecord(pr: RolimBoxDB['personalRecords']['value']): Promise<void> {
	const db = await getDB();
	await db.put('personalRecords', pr);
}

export async function deleteCachedPersonalRecord(id: string): Promise<void> {
	const db = await getDB();
	await db.delete('personalRecords', id);
}

export async function clearCachedPersonalRecords(): Promise<void> {
	const db = await getDB();
	await db.clear('personalRecords');
}
```

**Step 6: Add cache flag helpers**

Add after personal record operations:

```typescript
// Cache status flags
export async function setCacheFlag(key: string): Promise<void> {
	const db = await getDB();
	await db.put('syncMeta', { key, timestamp: Date.now() });
}

export async function hasCacheFlag(key: string): Promise<boolean> {
	const db = await getDB();
	const meta = await db.get('syncMeta', key);
	return !!meta;
}

export async function clearCacheFlag(key: string): Promise<void> {
	const db = await getDB();
	await db.delete('syncMeta', key);
}
```

**Step 7: Update clearAllCachedData to include new stores**

Modify the `clearAllCachedData` function (around line 182) from:
```typescript
export async function clearAllCachedData(): Promise<void> {
	const db = await getDB();
	await Promise.all([db.clear('wods'), db.clear('sections'), db.clear('syncMeta'), db.clear('syncQueue')]);
}
```
To:
```typescript
export async function clearAllCachedData(): Promise<void> {
	const db = await getDB();
	await Promise.all([
		db.clear('wods'),
		db.clear('sections'),
		db.clear('syncMeta'),
		db.clear('syncQueue'),
		db.clear('exercises'),
		db.clear('personalRecords')
	]);
}
```

**Step 8: Run type check**

Run: `bun run check`
Expected: 0 errors (warnings OK)

**Step 9: Commit**

```bash
git add src/lib/db/indexeddb.ts
git commit -m "feat(cache): add IndexedDB stores for exercises and PRs"
```

---

## Task 2: Create Exercises API Endpoint

**Files:**
- Create: `src/routes/api/exercises/+server.ts`

**Step 1: Create the API endpoint file**

Create `src/routes/api/exercises/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { exercise } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import { seedExercises } from '$lib/server/db/seed-exercises';

export const GET: RequestHandler = async () => {
	// Ensure exercises are seeded
	await seedExercises();

	const exercises = await db
		.select({
			id: exercise.id,
			name: exercise.name,
			category: exercise.category,
			measurementType: exercise.measurementType,
			sortOrder: exercise.sortOrder
		})
		.from(exercise)
		.orderBy(asc(exercise.sortOrder));

	return json(exercises);
};
```

**Step 2: Test the endpoint manually**

Run: `bun run dev` (if not running)
Then: `curl http://localhost:5173/api/exercises | head -c 500`
Expected: JSON array of exercise objects

**Step 3: Commit**

```bash
git add src/routes/api/exercises/+server.ts
git commit -m "feat(api): add GET /api/exercises endpoint"
```

---

## Task 3: Create PRs API Endpoint

**Files:**
- Create: `src/routes/api/prs/+server.ts`

**Step 1: Create the API endpoint file**

Create `src/routes/api/prs/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { personalRecord } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const prs = await db
		.select({
			id: personalRecord.id,
			exerciseId: personalRecord.exerciseId,
			value: personalRecord.value,
			date: personalRecord.date,
			note: personalRecord.note
		})
		.from(personalRecord)
		.where(eq(personalRecord.userId, locals.user.id));

	return json(prs);
};
```

**Step 2: Run type check**

Run: `bun run check`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/routes/api/prs/+server.ts
git commit -m "feat(api): add GET /api/prs endpoint"
```

---

## Task 4: Create PR Service Layer

**Files:**
- Create: `src/lib/services/pr.ts`

**Step 1: Create the service file with imports and types**

Create `src/lib/services/pr.ts`:

```typescript
import { browser } from '$app/environment';
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
```

**Step 2: Add getExercises function**

Add after the types:

```typescript
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
		const response = await fetch('/api/exercises');
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
```

**Step 3: Add getUserPRs function**

Add after getExercises:

```typescript
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
		const response = await fetch('/api/prs');
		if (!response.ok) {
			if (response.status === 401) return [];
			throw new Error('Failed to fetch PRs');
		}

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
```

**Step 4: Add getExercisesWithPRs function**

Add after getUserPRs:

```typescript
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
```

**Step 5: Add cache invalidation function**

Add after getExercisesWithPRs:

```typescript
// ============================================================================
// CACHE INVALIDATION
// ============================================================================

export async function invalidatePRCache(): Promise<void> {
	if (!browser) return;
	await clearCacheFlag(PRS_CACHE_KEY);
	await clearCachedPersonalRecords();
}

export async function refreshPRCache(): Promise<void> {
	await invalidatePRCache();
	await getUserPRs(); // Re-fetch and cache
}
```

**Step 6: Run type check**

Run: `bun run check`
Expected: 0 errors

**Step 7: Commit**

```bash
git add src/lib/services/pr.ts
git commit -m "feat(services): add PR service with cache-first strategy"
```

---

## Task 5: Refactor PR Page to Use Service

**Files:**
- Modify: `src/routes/(app)/prs/+page.svelte`
- Modify: `src/routes/(app)/prs/+page.server.ts`

**Step 1: Simplify the server load function**

Replace contents of `src/routes/(app)/prs/+page.server.ts` with:

```typescript
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { UnitPreference } from '$lib/types/pr';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { activeWorkspaceId } = await parent();

	// Get user's unit preference (still needed server-side)
	let unitPreference: UnitPreference = 'metric';
	if (locals.user) {
		const [userData] = await db
			.select({ unitPreference: user.unitPreference })
			.from(user)
			.where(eq(user.id, locals.user.id));
		unitPreference = (userData?.unitPreference as UnitPreference) ?? 'metric';
	}

	return {
		unitPreference,
		activeWorkspaceId
	};
};
```

**Step 2: Update the page component script section**

Replace the script section of `src/routes/(app)/prs/+page.svelte`:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import {
		formatPRValue,
		type ExerciseWithBestPR,
		type ExerciseCategory,
		type UnitPreference,
		EXERCISE_CATEGORIES
	} from '$lib/types/pr';
	import type { PageData } from './$types';
	import PRModal from './PRModal.svelte';
	import ImportPRModal from './ImportPRModal.svelte';
	import LeaderboardTab from './LeaderboardTab.svelte';
	import { getExercisesWithPRs, invalidatePRCache } from '$lib/services/pr';

	let { data }: { data: PageData } = $props();

	// Reactive derived values from props
	let unitPreference = $derived(data.unitPreference);
	let activeWorkspaceId = $derived(data.activeWorkspaceId);

	// Client-side state
	let exercises = $state<ExerciseWithBestPR[]>([]);
	let loading = $state(true);

	// Tab state
	type TabId = 'my-prs' | 'leaderboard';
	let activeTab = $state<TabId>('my-prs');

	const tabs: { id: TabId; label: string }[] = [
		{ id: 'my-prs', label: 'My PRs' },
		{ id: 'leaderboard', label: 'Leaderboard' }
	];

	// State
	let searchQuery = $state('');
	let activeCategory = $state<ExerciseCategory>('weightlifting');
	let selectedExercise = $state<ExerciseWithBestPR | null>(null);
	let modalOpen = $state(false);
	let importModalOpen = $state(false);

	// Load exercises on mount
	onMount(async () => {
		exercises = await getExercisesWithPRs();
		loading = false;
	});

	// Derived
	let filteredExercises = $derived.by(() => {
		let result = exercises;

		// Filter by search
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter((ex: ExerciseWithBestPR) => ex.name.toLowerCase().includes(query));
		} else {
			// Filter by category only when not searching
			result = result.filter((ex: ExerciseWithBestPR) => ex.category === activeCategory);
		}

		return result;
	});

	let isSearching = $derived(searchQuery.trim().length > 0);

	// Handlers
	function handleExerciseClick(exercise: ExerciseWithBestPR) {
		selectedExercise = exercise;
		modalOpen = true;
	}

	function handleModalClose() {
		modalOpen = false;
		selectedExercise = null;
	}

	async function handlePRSaved() {
		await invalidatePRCache();
		exercises = await getExercisesWithPRs();
		toastStore.success('PR saved!');
	}

	async function handlePRDeleted() {
		await invalidatePRCache();
		exercises = await getExercisesWithPRs();
		toastStore.success('PR deleted');
	}

	async function handleImportSuccess() {
		await invalidatePRCache();
		exercises = await getExercisesWithPRs();
		toastStore.success('PRs imported successfully!');
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const categoryLabels: Record<ExerciseCategory, string> = {
		weightlifting: 'Weightlifting',
		benchmark: 'Benchmarks',
		gymnastics: 'Gymnastics',
		cardio: 'Cardio'
	};
</script>
```

**Step 3: Add loading skeleton to the template**

In the template section, wrap the "My PRs" tab content with a loading check. Find the `{#if activeTab === 'my-prs'}` block and update it:

```svelte
	{#if activeTab === 'my-prs'}
		{#if loading}
			<!-- Loading skeleton -->
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{#each Array(8) as _}
					<div class="rounded-xl border border-white/5 bg-white/5 p-4">
						<Skeleton variant="text" height="1.25rem" width="80%" />
						<Skeleton variant="text" height="1.5rem" width="50%" class="mt-2" />
						<Skeleton variant="text" height="0.75rem" width="60%" class="mt-1" />
					</div>
				{/each}
			</div>
		{:else}
			<!-- Search Bar -->
			<div class="relative">
				<!-- ... existing search bar code ... -->
			</div>

			<!-- Category Tabs (hidden when searching) -->
			{#if !isSearching}
				<!-- ... existing category tabs code ... -->
			{/if}

			<!-- Exercise Grid -->
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				<!-- ... existing exercise grid code ... -->
			</div>

			<!-- Empty state -->
			{#if filteredExercises.length === 0}
				<!-- ... existing empty state code ... -->
			{/if}
		{/if}
	{:else if activeTab === 'leaderboard'}
		<!-- ... existing leaderboard code ... -->
	{/if}
```

**Step 4: Run type check**

Run: `bun run check`
Expected: 0 errors

**Step 5: Test manually**

1. Run: `bun run dev`
2. Open browser to PR tab
3. Verify exercises load with PRs
4. Navigate to Home tab
5. Return to PR tab - should load instantly from cache
6. Open DevTools > Application > IndexedDB > rolimbox
7. Verify `exercises` and `personalRecords` stores have data

**Step 6: Commit**

```bash
git add src/routes/(app)/prs/+page.svelte src/routes/(app)/prs/+page.server.ts
git commit -m "feat(prs): switch to client-side caching for exercises and PRs"
```

---

## Task 6: Final Integration Test

**Step 1: Full flow test**

1. Clear browser data (Application > Clear site data)
2. Navigate to PR tab
3. Verify loading skeleton appears briefly
4. Verify exercises load with any existing PRs
5. Check IndexedDB has `exercises` and `personalRecords` stores populated

**Step 2: Test cache invalidation**

1. Open PR modal for an exercise
2. Add or update a PR
3. Verify PR updates in the list immediately
4. Navigate away and back - PR should persist

**Step 3: Test navigation performance**

1. Navigate: PR tab → Home → PR tab
2. Second load should be instant (no network request)
3. Check Network tab - no `/api/exercises` or `/api/prs` calls on second visit

**Step 4: Run full type check**

Run: `bun run check`
Expected: 0 errors

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(prs): complete PR tab caching implementation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Extend IndexedDB schema | `indexeddb.ts` |
| 2 | Create exercises API | `api/exercises/+server.ts` |
| 3 | Create PRs API | `api/prs/+server.ts` |
| 4 | Create PR service | `services/pr.ts` |
| 5 | Refactor PR page | `prs/+page.svelte`, `prs/+page.server.ts` |
| 6 | Integration testing | Manual verification |

**Total commits:** 5-6 atomic commits
