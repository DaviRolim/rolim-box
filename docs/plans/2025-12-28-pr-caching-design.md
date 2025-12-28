# PR Tab Caching Design

**Date**: 2025-12-28
**Status**: Approved
**Goal**: Improve PR tab performance via client-side caching

## Overview

Add IndexedDB caching to the PR tab to eliminate redundant server requests on navigation. This follows the existing caching patterns established for WoDs but without offline write support.

### Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Caching goal | Performance optimization | PRs are reference data, not critical for offline use |
| Exercise caching | Cache indefinitely | Static data, seeded once, never changes |
| PR caching | Invalidate on write | Only changes when user explicitly saves/deletes |
| Storage | IndexedDB | Consistent with WoDs, better for structured data |

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        PR Tab Load                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   1. Check IndexedDB for exercises                          │
│      ├─ HIT → Use cached exercises                          │
│      └─ MISS → Fetch from server, cache, return             │
│                                                             │
│   2. Check IndexedDB for user PRs                           │
│      ├─ HIT → Use cached PRs                                │
│      └─ MISS → Fetch from server, cache, return             │
│                                                             │
│   3. Merge exercises + PRs client-side                      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                      PR Save/Delete                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   1. Send to server API                                     │
│   2. On success → Update IndexedDB cache                    │
│   3. Reactive store updates UI automatically                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Difference from WoDs

No sync queue needed since we're not supporting offline writes. Writes go directly to server, cache updates on success.

## IndexedDB Schema Changes

Add to `src/lib/db/indexeddb.ts`:

```typescript
// Add to RolimBoxDB interface
exercises: {
  key: string;
  value: {
    id: string;
    name: string;
    category: string;        // 'weightlifting' | 'benchmark' | 'gymnastics' | 'cardio'
    measurementType: string; // 'weight' | 'time' | 'reps' | 'distance'
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

// Reuse syncMeta store for cache flags
// Keys: 'exercises-cached', 'prs-cached'
```

**Database version**: `DB_VERSION = 2` → `DB_VERSION = 3`

## Service Layer

New file: `src/lib/services/pr.ts`

```typescript
// ─────────────────────────────────────────────────────────
// EXERCISES (cached indefinitely)
// ─────────────────────────────────────────────────────────

getExercises(): Promise<Exercise[]>
  // 1. Check if 'exercises-cached' flag exists in syncMeta
  // 2. If cached → return from IndexedDB
  // 3. If not → fetch from /api/exercises, cache all, set flag, return

// ─────────────────────────────────────────────────────────
// PERSONAL RECORDS (invalidate on write)
// ─────────────────────────────────────────────────────────

getUserPRs(): Promise<PersonalRecord[]>
  // 1. Check if 'prs-cached' flag exists
  // 2. If cached → return from IndexedDB
  // 3. If not → fetch from /api/prs, cache all, set flag, return

savePR(data: CreatePRInput): Promise<PersonalRecord>
  // 1. POST to /api/prs
  // 2. On success → update IndexedDB (add/replace PR for that exercise)
  // 3. Return saved PR

deletePR(id: string): Promise<void>
  // 1. DELETE to /api/prs/:id
  // 2. On success → remove from IndexedDB

// ─────────────────────────────────────────────────────────
// COMBINED (for UI convenience)
// ─────────────────────────────────────────────────────────

getExercisesWithPRs(): Promise<ExerciseWithBestPR[]>
  // 1. Call getExercises() and getUserPRs() in parallel
  // 2. Merge client-side (same logic currently in +page.server.ts)
  // 3. Return combined data
```

## API Endpoints

### GET /api/exercises

`src/routes/api/exercises/+server.ts`

```typescript
export const GET: RequestHandler = async () => {
  const exercises = await db
    .select()
    .from(exercise)
    .orderBy(asc(exercise.sortOrder));

  return json(exercises);
};
```

### GET /api/prs

`src/routes/api/prs/+server.ts`

```typescript
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) return json([], { status: 401 });

  const prs = await db
    .select()
    .from(personalRecord)
    .where(eq(personalRecord.userId, locals.user.id));

  return json(prs);
};
```

## Page Component Changes

`src/routes/(app)/prs/+page.svelte` switches from server data to client service:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { getExercisesWithPRs } from '$lib/services/pr';

  let exercises = $state<ExerciseWithBestPR[]>([]);
  let loading = $state(true);

  // Still need from server (via layout): activeWorkspaceId, unitPreference
  let { data } = $props();

  onMount(async () => {
    exercises = await getExercisesWithPRs();
    loading = false;
  });

  async function handlePRSaved() {
    exercises = await getExercisesWithPRs(); // Re-fetch from cache
    toastStore.success('PR saved!');
  }
</script>
```

### What stays server-side

- `unitPreference` - user setting
- `activeWorkspaceId` - from layout parent

### What moves client-side

- Exercises list
- Personal records
- Merging logic

## Files to Change

| Action | File |
|--------|------|
| Modify | `src/lib/db/indexeddb.ts` - add stores, bump version |
| Create | `src/lib/services/pr.ts` - cache-first service |
| Create | `src/routes/api/exercises/+server.ts` |
| Create | `src/routes/api/prs/+server.ts` |
| Modify | `src/routes/(app)/prs/+page.svelte` - use service |
| Simplify | `src/routes/(app)/prs/+page.server.ts` - remove exercises/PRs loading |

## Future Considerations

- **Full offline support**: Could add sync queue for PRs if users request offline write capability
- **Multi-device sync**: Could add "pull to refresh" or background refresh on app focus
- **Cache versioning**: If exercises schema changes, bump a cache version key to invalidate
