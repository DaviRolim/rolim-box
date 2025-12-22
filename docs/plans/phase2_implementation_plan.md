# Phase 2: WoD Management - Implementation Plan

**Reference**: [Development Phases Spec](../specs/development_phases_spec.md)
**Phase**: 2 of 5
**Status**: Ready for Implementation
**Date**: December 22, 2025

---

## Overview

Phase 2 implements the complete WoD (Workout of the Day) creation, editing, and library management system. This builds upon the Phase 1 foundation.

### Design Decisions (from brainstorming)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Library UI | Simple card list | Faster to build, matches spec, calendar can come later |
| Sync strategy | Optimistic with queue | Best UX for spotty wifi, instant feedback |
| Section reordering | Up/down buttons | Reliable on mobile, no library needed |
| Creation flow | Single page form | Fewer clicks, everything visible |
| Content editor | Plain textarea | Flexible for varied workout formats |
| API structure | Hybrid (form actions + REST) | Progressive enhancement + sync support |
| Delete confirmation | Modal dialog | Clear, familiar, accessible |

### Phase 1 Foundation Available

- Database schema with `wod` and `section` tables
- IndexedDB cache layer with WoD/section stores
- Authentication and session management
- Protected routes structure (`/(app)/`)
- Online/offline detection (`syncStore`)
- Design system (purple/pink palette, typography)
- `generateId()` utility for client-side ID generation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  Library Page │ Create Page │ Edit Page │ View Page          │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                     WoD Service                              │
│  - Offline-first read (cache → API → update cache)          │
│  - Optimistic write (IndexedDB → queue → API)               │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   IndexedDB   │   │  Sync Queue   │   │   REST API    │
│  (cache)      │   │  (pending ops)│   │  /api/wods    │
└───────────────┘   └───────────────┘   └───────────────┘
                            │                   │
                            └───────────────────┘
                                    │
                            ┌───────▼───────┐
                            │   Turso DB    │
                            │   (SQLite)    │
                            └───────────────┘
```

---

## Implementation Tasks

### Task 1: WoD Types & Validation

**Location**: `src/lib/types/wod.ts`

Define TypeScript types and Zod schemas for validation.

```typescript
// Types
interface WoD {
  id: string;
  workspaceId: string;
  date: string; // YYYY-MM-DD
  description: string | null;
  sections: Section[];
  createdAt: Date;
  updatedAt: Date;
}

interface Section {
  id: string;
  wodId: string;
  type: SectionType;
  name: string;
  content: string;
  order: number;
  timerConfig: string | null; // Reserved for Phase 3
}

type SectionType = 'warmup' | 'skill' | 'wod' | 'cooldown' | 'stretches' | 'custom';

// Validation schemas (Zod)
const createWoDSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).nullable(),
  sections: z.array(sectionSchema)
});

const sectionSchema = z.object({
  type: z.enum(['warmup', 'skill', 'wod', 'cooldown', 'stretches', 'custom']),
  name: z.string().min(1).max(100),
  content: z.string().max(2000),
  order: z.number().int().min(0)
});
```

**Deliverables**:
- `src/lib/types/wod.ts` - Types and Zod schemas

---

### Task 2: REST API Endpoints

**Location**: `src/routes/api/wods/`

Create RESTful endpoints for server operations. These support the sync queue and programmatic access.

#### 2.1 List & Create WoDs
**File**: `src/routes/api/wods/+server.ts`

```
GET /api/wods?workspaceId={id}
- Returns: WoD[] ordered by date DESC
- Auth: Required (validate workspace membership)

POST /api/wods
- Body: { workspaceId, date, description, sections[] }
- Returns: Created WoD with sections
- Validates: Zod schema
```

#### 2.2 Single WoD Operations
**File**: `src/routes/api/wods/[id]/+server.ts`

```
GET /api/wods/[id]
- Returns: WoD with all sections
- Auth: Validate workspace membership

PUT /api/wods/[id]
- Body: { date?, description?, sections[] }
- Replaces sections entirely (simpler than patch)
- Returns: Updated WoD

DELETE /api/wods/[id]
- Cascade deletes sections (DB constraint)
- Returns: 204 No Content
```

#### 2.3 Duplicate WoD
**File**: `src/routes/api/wods/[id]/duplicate/+server.ts`

```
POST /api/wods/[id]/duplicate
- Body: { newDate? } (defaults to today)
- Creates copy with new IDs
- Returns: New WoD
```

**Deliverables**:
- `src/routes/api/wods/+server.ts`
- `src/routes/api/wods/[id]/+server.ts`
- `src/routes/api/wods/[id]/duplicate/+server.ts`

---

### Task 3: Sync Queue System

**Location**: `src/lib/services/sync-queue.ts`

Implement offline mutation queue with IndexedDB persistence.

#### 3.1 Queue Data Structure

```typescript
interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'wod';
  entityId: string;
  payload: unknown;
  createdAt: number;
  retries: number;
}
```

#### 3.2 IndexedDB Schema Update

Add `syncQueue` object store to `src/lib/db/indexeddb.ts`:

```typescript
const stores = {
  wods: { keyPath: 'id', indexes: ['by-workspace', 'by-date'] },
  sections: { keyPath: 'id', indexes: ['by-wod'] },
  syncMeta: { keyPath: 'key' },
  syncQueue: { keyPath: 'id', indexes: ['by-entity'] }  // NEW
};
```

#### 3.3 Queue Operations

```typescript
// Add operation to queue
async function queueOperation(op: Omit<SyncOperation, 'id' | 'createdAt' | 'retries'>): Promise<void>

// Process queue (called when online)
async function processQueue(): Promise<void>

// Clear queue for entity (on successful sync)
async function clearQueuedOperations(entityId: string): Promise<void>
```

#### 3.4 Sync Trigger

- Listen to `syncStore.isOnline` changes
- When transitioning offline → online, call `processQueue()`
- Process in FIFO order
- Max 3 retries with exponential backoff (1s, 2s, 4s)
- On persistent failure, keep in queue and notify user

**Deliverables**:
- `src/lib/services/sync-queue.ts`
- Update `src/lib/db/indexeddb.ts` (add syncQueue store)

---

### Task 4: WoD Service Layer

**Location**: `src/lib/services/wod.ts`

Unified service for all WoD operations, handling offline-first logic.

#### 4.1 Read Operations (Cache-First)

```typescript
async function listWoDs(workspaceId: string): Promise<WoD[]> {
  // 1. Return cached data immediately
  const cached = await getCachedWodsByWorkspace(workspaceId);

  // 2. If online, fetch fresh data in background
  if (syncStore.isOnline) {
    fetchAndUpdateCache(workspaceId);
  }

  return cached;
}

async function getWoD(id: string): Promise<WoD | null> {
  // Check cache first, then API if online
}
```

#### 4.2 Write Operations (Optimistic)

```typescript
async function createWoD(data: CreateWoDInput): Promise<WoD> {
  // 1. Generate ID client-side
  const id = generateId();
  const wod = { id, ...data, createdAt: new Date(), updatedAt: new Date() };

  // 2. Save to IndexedDB immediately
  await cacheWod(wod);

  // 3. Queue sync operation
  await queueOperation({ type: 'create', entity: 'wod', entityId: id, payload: wod });

  // 4. If online, process queue immediately
  if (syncStore.isOnline) {
    processQueue();
  }

  return wod;
}

async function updateWoD(id: string, data: UpdateWoDInput): Promise<WoD>
async function deleteWoD(id: string): Promise<void>
async function duplicateWoD(id: string, newDate?: string): Promise<WoD>
```

**Deliverables**:
- `src/lib/services/wod.ts`

---

### Task 5: UI Components - Core

**Location**: `src/lib/components/`

#### 5.1 Confirm Modal
**File**: `src/lib/components/ConfirmModal.svelte`

```svelte
<script>
  let { open, title, message, confirmText, onConfirm, onCancel } = $props();
</script>

<!-- Accessible modal with focus trap -->
<!-- Escape key closes -->
<!-- Click outside closes -->
```

#### 5.2 Toast Notifications
**File**: `src/lib/components/Toast.svelte`
**File**: `src/lib/stores/toast.svelte.ts`

```typescript
// Toast store
const toastStore = {
  show(message: string, type: 'success' | 'error' | 'info'): void,
  dismiss(id: string): void
};
```

Toast types:
- Success: "WoD saved" (green)
- Error: "Failed to save" (red)
- Info: "Working offline" (yellow)

#### 5.3 Loading Skeleton
**File**: `src/lib/components/Skeleton.svelte`

Configurable skeleton for:
- Text lines (varying widths)
- Card shapes
- Animated shimmer effect

**Deliverables**:
- `src/lib/components/ConfirmModal.svelte`
- `src/lib/components/Toast.svelte`
- `src/lib/stores/toast.svelte.ts`
- `src/lib/components/Skeleton.svelte`

---

### Task 6: Section Components

**Location**: `src/lib/components/sections/`

#### 6.1 Section Type Config
**File**: `src/lib/config/section-types.ts`

```typescript
export const sectionTypes = {
  warmup: { label: 'Warmup', icon: '🔥', color: 'orange' },
  skill: { label: 'Skill', icon: '🎯', color: 'blue' },
  wod: { label: 'WoD', icon: '💪', color: 'pink' },
  cooldown: { label: 'Cool-down', icon: '❄️', color: 'cyan' },
  stretches: { label: 'Stretches', icon: '🧘', color: 'purple' },
  custom: { label: 'Custom', icon: '⚙️', color: 'gray' }
};
```

#### 6.2 Section Card
**File**: `src/lib/components/sections/SectionCard.svelte`

Display a section with:
- Type badge (icon + label + color)
- Section name
- Content (truncated or full)
- Reorder buttons (↑ ↓)
- Edit/Delete buttons
- Timer placeholder (disabled, "Phase 3")

#### 6.3 Section List
**File**: `src/lib/components/sections/SectionList.svelte`

```svelte
<script>
  let { sections, onReorder, onEdit, onDelete } = $props();
</script>

{#each sections as section, index}
  <SectionCard
    {section}
    canMoveUp={index > 0}
    canMoveDown={index < sections.length - 1}
    onMoveUp={() => onReorder(index, index - 1)}
    onMoveDown={() => onReorder(index, index + 1)}
    onEdit={() => onEdit(section)}
    onDelete={() => onDelete(section)}
  />
{/each}
```

#### 6.4 Add Section Form
**File**: `src/lib/components/sections/AddSectionForm.svelte`

Inline form (not modal) for adding sections:
- Type selector (6 preset buttons)
- Name input (auto-fills from type, editable)
- Content textarea
- Add button
- Timer attachment (disabled with "Coming soon" label)

#### 6.5 Edit Section Form
**File**: `src/lib/components/sections/EditSectionForm.svelte`

Same as Add, but:
- Pre-populated with existing data
- Save/Cancel buttons

**Deliverables**:
- `src/lib/config/section-types.ts`
- `src/lib/components/sections/SectionCard.svelte`
- `src/lib/components/sections/SectionList.svelte`
- `src/lib/components/sections/AddSectionForm.svelte`
- `src/lib/components/sections/EditSectionForm.svelte`

---

### Task 7: Workout Library Page

**Location**: `src/routes/(app)/workouts/+page.svelte`

Main list view for all workouts.

#### 7.1 Page Layout

```
┌─────────────────────────────────────┐
│ Workouts                [+ New WoD] │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Sunday, Dec 22, 2025            │ │
│ │ AMRAP 20: Wall balls, box...    │ │
│ │ [View] [Edit] [Duplicate] [🗑️]  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Saturday, Dec 21, 2025          │ │
│ │ EMOM 12: Deadlifts, pull-ups... │ │
│ │ [View] [Edit] [Duplicate] [🗑️]  │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

#### 7.2 Features

- Load WoDs from service (cache-first)
- Chronological order (newest first)
- Card for each WoD: date, description preview (max 100 chars)
- Actions: View, Edit, Duplicate, Delete
- Delete triggers ConfirmModal
- Duplicate prompts for new date, defaults to today
- Empty state: "No workouts yet. Create your first!"
- Loading state: Skeleton cards

#### 7.3 Server Load

**File**: `src/routes/(app)/workouts/+page.server.ts`

```typescript
export async function load({ locals }) {
  // Fetch WoDs from DB for initial render (SSR)
  // Client will use service layer for updates
}
```

**Deliverables**:
- `src/routes/(app)/workouts/+page.svelte`
- `src/routes/(app)/workouts/+page.server.ts`

---

### Task 8: WoD Create Page

**Location**: `src/routes/(app)/workouts/new/`

Single-page form for creating a new WoD.

#### 8.1 Page Layout

```
┌─────────────────────────────────────┐
│ ← Cancel            New Workout     │
├─────────────────────────────────────┤
│ Date                                │
│ ┌─────────────────────────────────┐ │
│ │ 2025-12-22                    📅│ │
│ └─────────────────────────────────┘ │
│                                     │
│ Description (optional)              │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Sections                            │
│ ┌─────────────────────────────────┐ │
│ │ (No sections yet)               │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [+ Add Section]                     │
│                                     │
│         [Save Workout]              │
└─────────────────────────────────────┘
```

#### 8.2 Features

- Date picker, defaults to today
- Description textarea (optional)
- Section list (empty initially)
- "Add Section" expands AddSectionForm inline
- Sections can be reordered, edited, deleted before save
- "Save Workout" validates and calls service
- Redirect to library on success
- Toast on success/error
- Cancel navigates back without saving

#### 8.3 Form Action

**File**: `src/routes/(app)/workouts/new/+page.server.ts`

```typescript
export const actions = {
  default: async ({ request, locals }) => {
    // Validate form data
    // Create WoD via DB
    // Return success or errors
  }
};
```

**Deliverables**:
- `src/routes/(app)/workouts/new/+page.svelte`
- `src/routes/(app)/workouts/new/+page.server.ts`

---

### Task 9: WoD View Page

**Location**: `src/routes/(app)/workouts/[id]/`

Read-only display of a workout.

#### 9.1 Page Layout

```
┌─────────────────────────────────────┐
│ ← Back        Dec 22, 2025    [Edit]│
├─────────────────────────────────────┤
│                                     │
│ AMRAP 20 minutes of wall balls,     │
│ box jumps, and burpees              │
│                                     │
├─────────────────────────────────────┤
│ 🔥 WARMUP                           │
│ ─────────────────────────────────── │
│ 400m run                            │
│ 20 air squats                       │
│ 10 push-ups                         │
│                          [▶️ Timer] │
├─────────────────────────────────────┤
│ 💪 WOD                              │
│ ─────────────────────────────────── │
│ AMRAP 20:                           │
│ 15 Wall balls (20/14)               │
│ 12 Box jumps (24/20)                │
│ 9 Burpees                           │
│                          [▶️ Timer] │
└─────────────────────────────────────┘
```

#### 9.2 Features

- Full workout display
- All sections in order
- Section content fully visible (not truncated)
- Edit button in header → navigate to edit page
- Timer button per section (disabled, "Coming in Phase 3")
- Back button → return to library
- 404 handling if WoD not found

**Deliverables**:
- `src/routes/(app)/workouts/[id]/+page.svelte`
- `src/routes/(app)/workouts/[id]/+page.server.ts`

---

### Task 10: WoD Edit Page

**Location**: `src/routes/(app)/workouts/[id]/edit/`

Same UI as Create, but pre-populated.

#### 10.1 Features

- Load existing WoD data
- Pre-fill all fields
- Same section management as Create
- "Save Changes" updates via service
- Cancel returns to View page
- Show "Last updated: {timestamp}"
- 404 handling if WoD not found

#### 10.2 Form Action

```typescript
export const actions = {
  default: async ({ request, locals, params }) => {
    // Validate form data
    // Update WoD via DB
    // Replace sections entirely
    // Return success or errors
  }
};
```

**Deliverables**:
- `src/routes/(app)/workouts/[id]/edit/+page.svelte`
- `src/routes/(app)/workouts/[id]/edit/+page.server.ts`

---

### Task 11: Dashboard Integration

**Location**: `src/routes/(app)/dashboard/+page.svelte`

Update dashboard with WoD quick access.

#### 11.1 Features

- "Today's Workout" card (if exists, else "Create Today's WoD")
- Quick link to Workouts library
- Recent workouts (last 3) with View links

#### 11.2 Layout

```
┌─────────────────────────────────────┐
│ Dashboard                           │
├─────────────────────────────────────┤
│ Today's Workout                     │
│ ┌─────────────────────────────────┐ │
│ │ AMRAP 20...                     │ │
│ │ [View] [Edit]                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Quick Actions                       │
│ [+ New WoD]  [📋 All Workouts]     │
│                                     │
│ Recent Workouts                     │
│ • Dec 21 - EMOM 12...              │
│ • Dec 20 - For Time...             │
│ • Dec 19 - Tabata...               │
└─────────────────────────────────────┘
```

**Deliverables**:
- Update `src/routes/(app)/dashboard/+page.svelte`
- Update `src/routes/(app)/dashboard/+page.server.ts`

---

### Task 12: Navigation Updates

**Location**: `src/routes/(app)/+layout.svelte`

Add proper navigation for the app.

#### 12.1 Bottom Navigation (Mobile)

```
┌─────────────────────────────────────┐
│                                     │
│           Page Content              │
│                                     │
├─────────────────────────────────────┤
│   🏠        📋        ⏱️            │
│  Home    Workouts   Timers         │
└─────────────────────────────────────┘
```

#### 12.2 Features

- Fixed bottom nav on mobile
- Active state indicator
- Timers link disabled ("Coming in Phase 3")
- Responsive: sidebar on larger screens (optional)

**Deliverables**:
- Update `src/routes/(app)/+layout.svelte`
- `src/lib/components/BottomNav.svelte`

---

## File Structure Summary

```
src/
├── lib/
│   ├── components/
│   │   ├── ConfirmModal.svelte         # Task 5
│   │   ├── Toast.svelte                # Task 5
│   │   ├── Skeleton.svelte             # Task 5
│   │   ├── BottomNav.svelte            # Task 12
│   │   └── sections/
│   │       ├── SectionCard.svelte      # Task 6
│   │       ├── SectionList.svelte      # Task 6
│   │       ├── AddSectionForm.svelte   # Task 6
│   │       └── EditSectionForm.svelte  # Task 6
│   ├── config/
│   │   └── section-types.ts            # Task 6
│   ├── services/
│   │   ├── wod.ts                      # Task 4
│   │   └── sync-queue.ts               # Task 3
│   ├── stores/
│   │   └── toast.svelte.ts             # Task 5
│   ├── types/
│   │   └── wod.ts                      # Task 1
│   └── db/
│       └── indexeddb.ts                # Update: Task 3
├── routes/
│   ├── api/
│   │   └── wods/
│   │       ├── +server.ts              # Task 2
│   │       └── [id]/
│   │           ├── +server.ts          # Task 2
│   │           └── duplicate/
│   │               └── +server.ts      # Task 2
│   └── (app)/
│       ├── +layout.svelte              # Update: Task 12
│       ├── dashboard/
│       │   ├── +page.svelte            # Update: Task 11
│       │   └── +page.server.ts         # Update: Task 11
│       └── workouts/
│           ├── +page.svelte            # Task 7
│           ├── +page.server.ts         # Task 7
│           ├── new/
│           │   ├── +page.svelte        # Task 8
│           │   └── +page.server.ts     # Task 8
│           └── [id]/
│               ├── +page.svelte        # Task 9
│               ├── +page.server.ts     # Task 9
│               └── edit/
│                   ├── +page.svelte    # Task 10
│                   └── +page.server.ts # Task 10
```

**New files**: ~22 files
**Updated files**: ~4 files

---

## Implementation Order

### Batch 1: Foundation (Tasks 1-4)
Build the data layer and service infrastructure.

1. **Task 1**: Types & validation schemas
2. **Task 2**: REST API endpoints
3. **Task 3**: Sync queue system
4. **Task 4**: WoD service layer

### Batch 2: Components (Tasks 5-6)
Build reusable UI components.

5. **Task 5**: Core components (Modal, Toast, Skeleton)
6. **Task 6**: Section components

### Batch 3: Pages (Tasks 7-10)
Build the main pages.

7. **Task 7**: Workout library page
8. **Task 8**: WoD create page
9. **Task 9**: WoD view page
10. **Task 10**: WoD edit page

### Batch 4: Integration (Tasks 11-12)
Connect everything together.

11. **Task 11**: Dashboard integration
12. **Task 12**: Navigation updates

---

## Testing Checklist

### Functional Tests
- [ ] Create new WoD with sections
- [ ] View WoD with all sections
- [ ] Edit WoD (change date, description, sections)
- [ ] Delete WoD with confirmation
- [ ] Duplicate WoD with new date
- [ ] Add section to WoD
- [ ] Edit section content
- [ ] Delete section from WoD
- [ ] Reorder sections (up/down)

### Offline Tests
- [ ] Create WoD while offline → appears in list
- [ ] Edit WoD while offline → changes persist
- [ ] Delete WoD while offline → removed from list
- [ ] Changes sync when back online
- [ ] Sync queue processes in order
- [ ] Failed syncs retry with backoff

### UI/UX Tests
- [ ] Mobile responsive (375px width)
- [ ] Touch targets >= 44px
- [ ] Loading skeletons display
- [ ] Error toasts appear
- [ ] Empty states are helpful
- [ ] Delete confirmation works
- [ ] Form validation shows errors

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Sync conflicts | Last-write-wins + show "last updated" timestamp |
| Large workout content | Truncate in list view, full display in view page |
| Slow initial load | Skeleton loading states, cache-first reads |
| Form data loss | Confirm before navigating away with unsaved changes |
| Section order bugs | Use explicit `order` field, recalculate on reorder |

---

## Success Criteria

Phase 2 is complete when:

1. Users can create WoDs with date, description, and multiple sections
2. Users can view, edit, duplicate, and delete WoDs
3. Sections support all 6 types with add, edit, remove, reorder
4. Data persists to IndexedDB immediately
5. Sync queue processes when online
6. UI follows design system (purple/pink theme)
7. All pages are mobile-responsive
8. Empty, loading, and error states are handled
9. Timer attachment UI shows "Coming in Phase 3"

---

## Document Control

**Version**: 1.0
**Created**: December 22, 2025
**Status**: Ready for Implementation
**Next Step**: Begin Task 1 - Types & Validation
