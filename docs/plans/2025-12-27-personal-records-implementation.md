# Personal Records Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a Personal Records (PRs) feature allowing users to track their best performances across predefined exercises.

**Architecture:** Add two new database tables (Exercise, PersonalRecord) with a seeding mechanism. Create API endpoints for CRUD operations. Build a PR page with category tabs, card grid, search, and modal interactions. Add unit preference to user settings.

**Tech Stack:** SvelteKit, Drizzle ORM (SQLite), Svelte 5 runes, Tailwind CSS, Zod validation

---

## Task 1: Add Database Schema

**Files:**
- Modify: `src/lib/server/db/schema.ts`

**Step 1: Add exercise and personalRecord tables to schema**

Add after the existing `section` table definition:

```typescript
// Exercise (predefined, seeded)
export const exercise = sqliteTable('exercise', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	category: text('category').notNull(), // 'weightlifting' | 'benchmark' | 'gymnastics' | 'cardio'
	measurementType: text('measurement_type').notNull(), // 'weight' | 'time' | 'reps' | 'distance'
	sortOrder: integer('sort_order').notNull()
});

// Personal Record
export const personalRecord = sqliteTable('personal_record', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	exerciseId: text('exercise_id')
		.notNull()
		.references(() => exercise.id),
	value: integer('value').notNull(), // stored in base units: grams, seconds, count, centimeters
	note: text('note'),
	date: text('date').notNull(), // ISO date: "2025-12-27"
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});
```

**Step 2: Add unitPreference to user table**

Modify the `user` table to add:

```typescript
export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	unitPreference: text('unit_preference').notNull().default('metric') // 'metric' | 'imperial'
});
```

**Step 3: Add type exports**

Add after existing type exports:

```typescript
export type Exercise = typeof exercise.$inferSelect;
export type PersonalRecord = typeof personalRecord.$inferSelect;
```

**Step 4: Run migration**

Run: `DATABASE_URL="file:local.db" bunx drizzle-kit push`
Expected: Tables created successfully

**Step 5: Commit**

```bash
git add src/lib/server/db/schema.ts
git commit -m "feat(pr): add exercise and personal_record tables to schema"
```

---

## Task 2: Create Exercise Seed Data

**Files:**
- Create: `src/lib/server/db/seed-exercises.ts`

**Step 1: Create seed file with all predefined exercises**

```typescript
import { db } from '$lib/server/db';
import { exercise } from '$lib/server/db/schema';
import { generateId } from '$lib/server/auth';

type ExerciseCategory = 'weightlifting' | 'benchmark' | 'gymnastics' | 'cardio';
type MeasurementType = 'weight' | 'time' | 'reps' | 'distance';

interface ExerciseSeed {
	name: string;
	category: ExerciseCategory;
	measurementType: MeasurementType;
}

const exercises: ExerciseSeed[] = [
	// Weightlifting
	{ name: 'Back Squat', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Front Squat', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Overhead Squat', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Deadlift', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Clean', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Clean & Jerk', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Snatch', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Power Clean', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Power Snatch', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Push Press', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Push Jerk', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Strict Press', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Bench Press', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Thruster', category: 'weightlifting', measurementType: 'weight' },
	// Benchmarks
	{ name: 'Fran', category: 'benchmark', measurementType: 'time' },
	{ name: 'Grace', category: 'benchmark', measurementType: 'time' },
	{ name: 'Isabel', category: 'benchmark', measurementType: 'time' },
	{ name: 'Helen', category: 'benchmark', measurementType: 'time' },
	{ name: 'Diane', category: 'benchmark', measurementType: 'time' },
	{ name: 'Elizabeth', category: 'benchmark', measurementType: 'time' },
	{ name: 'Nancy', category: 'benchmark', measurementType: 'time' },
	{ name: 'Annie', category: 'benchmark', measurementType: 'time' },
	{ name: 'Jackie', category: 'benchmark', measurementType: 'time' },
	{ name: 'Karen', category: 'benchmark', measurementType: 'time' },
	{ name: 'Murph', category: 'benchmark', measurementType: 'time' },
	{ name: 'Cindy - 20 min', category: 'benchmark', measurementType: 'reps' },
	{ name: 'Fight Gone Bad', category: 'benchmark', measurementType: 'reps' },
	// Gymnastics
	{ name: 'Max Pull-ups', category: 'gymnastics', measurementType: 'reps' },
	{ name: 'Max Chest-to-Bar', category: 'gymnastics', measurementType: 'reps' },
	{ name: 'Max Muscle-ups', category: 'gymnastics', measurementType: 'reps' },
	{ name: 'Max Ring Muscle-ups', category: 'gymnastics', measurementType: 'reps' },
	{ name: 'Max Handstand Push-ups', category: 'gymnastics', measurementType: 'reps' },
	{ name: 'Max Toes-to-Bar', category: 'gymnastics', measurementType: 'reps' },
	{ name: 'Max Double-unders', category: 'gymnastics', measurementType: 'reps' },
	// Cardio
	{ name: '400m Run', category: 'cardio', measurementType: 'time' },
	{ name: '800m Run', category: 'cardio', measurementType: 'time' },
	{ name: '1 Mile Run', category: 'cardio', measurementType: 'time' },
	{ name: '5K Run', category: 'cardio', measurementType: 'time' },
	{ name: '500m Row', category: 'cardio', measurementType: 'time' },
	{ name: '2K Row', category: 'cardio', measurementType: 'time' },
	{ name: '1K Bike Erg', category: 'cardio', measurementType: 'time' },
	{ name: '5K Bike Erg', category: 'cardio', measurementType: 'time' }
];

export async function seedExercises(): Promise<void> {
	// Check if exercises already exist
	const existing = await db.select().from(exercise).limit(1);
	if (existing.length > 0) {
		console.log('Exercises already seeded, skipping...');
		return;
	}

	const categoryOrder: Record<ExerciseCategory, number> = {
		weightlifting: 0,
		benchmark: 100,
		gymnastics: 200,
		cardio: 300
	};

	const values = exercises.map((ex, index) => ({
		id: generateId(),
		name: ex.name,
		category: ex.category,
		measurementType: ex.measurementType,
		sortOrder: categoryOrder[ex.category] + index
	}));

	await db.insert(exercise).values(values);
	console.log(`Seeded ${values.length} exercises`);
}
```

**Step 2: Commit**

```bash
git add src/lib/server/db/seed-exercises.ts
git commit -m "feat(pr): add exercise seed data"
```

---

## Task 3: Create PR Types and Validation Schemas

**Files:**
- Create: `src/lib/types/pr.ts`

**Step 1: Create types and Zod schemas**

```typescript
import { z } from 'zod';

// ============================================================================
// Type Definitions
// ============================================================================

export type ExerciseCategory = 'weightlifting' | 'benchmark' | 'gymnastics' | 'cardio';
export type MeasurementType = 'weight' | 'time' | 'reps' | 'distance';
export type UnitPreference = 'metric' | 'imperial';

export const EXERCISE_CATEGORIES = ['weightlifting', 'benchmark', 'gymnastics', 'cardio'] as const;
export const MEASUREMENT_TYPES = ['weight', 'time', 'reps', 'distance'] as const;

export interface Exercise {
	id: string;
	name: string;
	category: ExerciseCategory;
	measurementType: MeasurementType;
	sortOrder: number;
}

export interface PersonalRecord {
	id: string;
	userId: string;
	exerciseId: string;
	value: number; // Base units: grams, seconds, count, centimeters
	note: string | null;
	date: string; // YYYY-MM-DD
	createdAt: Date;
	updatedAt: Date;
}

export interface ExerciseWithBestPR extends Exercise {
	bestPR: {
		value: number;
		date: string;
	} | null;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

export const createPRSchema = z.object({
	exerciseId: z.string().min(1, 'Exercise is required'),
	value: z.number().positive('Value must be positive'),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
		.refine((date) => {
			const parsed = new Date(date);
			return !isNaN(parsed.getTime());
		}, 'Invalid date'),
	note: z.string().max(500, 'Note too long').nullable().optional()
});

export const updateUserSettingsSchema = z.object({
	unitPreference: z.enum(['metric', 'imperial'])
});

// ============================================================================
// Type Inference from Schemas
// ============================================================================

export type CreatePRInput = z.infer<typeof createPRSchema>;
export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;

// ============================================================================
// Unit Conversion Utilities
// ============================================================================

// Storage: grams -> Display: kg or lbs
const GRAMS_PER_KG = 1000;
const GRAMS_PER_LB = 453.592;

// Storage: centimeters -> Display: meters or miles
const CM_PER_METER = 100;
const CM_PER_MILE = 160934;

export function convertWeightForDisplay(grams: number, unit: UnitPreference): number {
	if (unit === 'metric') {
		return Math.round((grams / GRAMS_PER_KG) * 100) / 100; // kg with 2 decimals
	}
	return Math.round((grams / GRAMS_PER_LB) * 100) / 100; // lbs with 2 decimals
}

export function convertWeightForStorage(value: number, unit: UnitPreference): number {
	if (unit === 'metric') {
		return Math.round(value * GRAMS_PER_KG); // kg to grams
	}
	return Math.round(value * GRAMS_PER_LB); // lbs to grams
}

export function convertDistanceForDisplay(cm: number, unit: UnitPreference): number {
	if (unit === 'metric') {
		return Math.round((cm / CM_PER_METER) * 100) / 100; // meters with 2 decimals
	}
	return Math.round((cm / CM_PER_MILE) * 1000) / 1000; // miles with 3 decimals
}

export function convertDistanceForStorage(value: number, unit: UnitPreference): number {
	if (unit === 'metric') {
		return Math.round(value * CM_PER_METER); // meters to cm
	}
	return Math.round(value * CM_PER_MILE); // miles to cm
}

// Time is stored in seconds, no conversion needed
export function formatTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;

	if (hours > 0) {
		return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parseTime(timeStr: string): number {
	const parts = timeStr.split(':').map(Number);
	if (parts.length === 3) {
		return parts[0] * 3600 + parts[1] * 60 + parts[2];
	}
	if (parts.length === 2) {
		return parts[0] * 60 + parts[1];
	}
	return parts[0];
}

export function formatPRValue(
	value: number,
	measurementType: MeasurementType,
	unit: UnitPreference
): string {
	switch (measurementType) {
		case 'weight':
			return `${convertWeightForDisplay(value, unit)}${unit === 'metric' ? 'kg' : 'lbs'}`;
		case 'time':
			return formatTime(value);
		case 'reps':
			return `${value} reps`;
		case 'distance':
			return `${convertDistanceForDisplay(value, unit)}${unit === 'metric' ? 'm' : 'mi'}`;
	}
}

export function getWeightUnit(unit: UnitPreference): string {
	return unit === 'metric' ? 'kg' : 'lbs';
}

export function getDistanceUnit(unit: UnitPreference): string {
	return unit === 'metric' ? 'm' : 'mi';
}

// Determine if higher or lower is better for a given measurement type
export function isBetterPR(
	newValue: number,
	oldValue: number,
	measurementType: MeasurementType
): boolean {
	if (measurementType === 'time') {
		return newValue < oldValue; // Lower time is better
	}
	return newValue > oldValue; // Higher weight/reps/distance is better
}
```

**Step 2: Commit**

```bash
git add src/lib/types/pr.ts
git commit -m "feat(pr): add PR types and validation schemas with unit conversion"
```

---

## Task 4: Create Exercises API Endpoint

**Files:**
- Create: `src/routes/api/exercises/+server.ts`

**Step 1: Create GET endpoint for exercises**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { exercise } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

/**
 * GET /api/exercises
 * Returns all predefined exercises ordered by sortOrder
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const exercises = await db
		.select()
		.from(exercise)
		.orderBy(asc(exercise.sortOrder));

	return json(exercises);
};
```

**Step 2: Commit**

```bash
git add src/routes/api/exercises/+server.ts
git commit -m "feat(pr): add exercises API endpoint"
```

---

## Task 5: Create PRs API Endpoints

**Files:**
- Create: `src/routes/api/prs/+server.ts`
- Create: `src/routes/api/prs/[id]/+server.ts`

**Step 1: Create main PRs endpoint (GET, POST)**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { personalRecord, exercise } from '$lib/server/db/schema';
import { createPRSchema } from '$lib/types/pr';
import { generateId } from '$lib/server/auth';
import { eq, and, desc } from 'drizzle-orm';

/**
 * GET /api/prs?exerciseId={id}
 * Returns user's PRs, optionally filtered by exerciseId
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const exerciseId = url.searchParams.get('exerciseId');

	let query = db
		.select()
		.from(personalRecord)
		.where(eq(personalRecord.userId, locals.user.id))
		.orderBy(desc(personalRecord.date));

	if (exerciseId) {
		query = db
			.select()
			.from(personalRecord)
			.where(
				and(
					eq(personalRecord.userId, locals.user.id),
					eq(personalRecord.exerciseId, exerciseId)
				)
			)
			.orderBy(desc(personalRecord.date));
	}

	const prs = await query;
	return json(prs);
};

/**
 * POST /api/prs
 * Creates a new PR
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const validation = createPRSchema.safeParse(body);
	if (!validation.success) {
		return json(
			{
				error: 'Validation failed',
				details: validation.error.flatten()
			},
			{ status: 400 }
		);
	}

	const data = validation.data;

	// Verify exercise exists
	const [ex] = await db
		.select()
		.from(exercise)
		.where(eq(exercise.id, data.exerciseId));

	if (!ex) {
		return json({ error: 'Exercise not found' }, { status: 404 });
	}

	const now = new Date();
	const [newPR] = await db
		.insert(personalRecord)
		.values({
			id: generateId(),
			userId: locals.user.id,
			exerciseId: data.exerciseId,
			value: data.value,
			note: data.note ?? null,
			date: data.date,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	return json(newPR, { status: 201 });
};
```

**Step 2: Create single PR endpoint (DELETE)**

Create `src/routes/api/prs/[id]/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { personalRecord } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * DELETE /api/prs/[id]
 * Deletes a PR (only if owned by current user)
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id } = params;

	// Verify PR exists and belongs to user
	const [pr] = await db
		.select()
		.from(personalRecord)
		.where(
			and(
				eq(personalRecord.id, id),
				eq(personalRecord.userId, locals.user.id)
			)
		);

	if (!pr) {
		return json({ error: 'PR not found' }, { status: 404 });
	}

	await db.delete(personalRecord).where(eq(personalRecord.id, id));

	return json({ success: true });
};
```

**Step 3: Commit**

```bash
git add src/routes/api/prs/+server.ts src/routes/api/prs/[id]/+server.ts
git commit -m "feat(pr): add PRs API endpoints"
```

---

## Task 6: Create User Settings API Endpoint

**Files:**
- Create: `src/routes/api/user/settings/+server.ts`

**Step 1: Create PATCH endpoint for user settings**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { updateUserSettingsSchema } from '$lib/types/pr';
import { eq } from 'drizzle-orm';

/**
 * GET /api/user/settings
 * Returns current user's settings
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const [userData] = await db
		.select({ unitPreference: user.unitPreference })
		.from(user)
		.where(eq(user.id, locals.user.id));

	return json({ unitPreference: userData?.unitPreference ?? 'metric' });
};

/**
 * PATCH /api/user/settings
 * Updates user settings
 */
export const PATCH: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const validation = updateUserSettingsSchema.safeParse(body);
	if (!validation.success) {
		return json(
			{
				error: 'Validation failed',
				details: validation.error.flatten()
			},
			{ status: 400 }
		);
	}

	const data = validation.data;

	await db
		.update(user)
		.set({ unitPreference: data.unitPreference })
		.where(eq(user.id, locals.user.id));

	return json({ success: true, unitPreference: data.unitPreference });
};
```

**Step 2: Commit**

```bash
git add src/routes/api/user/settings/+server.ts
git commit -m "feat(pr): add user settings API endpoint"
```

---

## Task 7: Update Bottom Navigation

**Files:**
- Modify: `src/lib/components/BottomNav.svelte`

**Step 1: Add PRs to navigation items**

Update the `navItems` array to include PRs and change grid to 4 columns:

```typescript
const navItems: NavItem[] = [
	{
		label: 'Home',
		path: '/dashboard',
		icon: 'home'
	},
	{
		label: 'Workouts',
		path: '/workouts',
		icon: 'workouts'
	},
	{
		label: 'PRs',
		path: '/prs',
		icon: 'prs'
	},
	{
		label: 'Timers',
		path: '/timers',
		icon: 'timers'
	}
];
```

**Step 2: Update grid to 4 columns**

Change `grid-cols-3` to `grid-cols-4`:

```svelte
<div class="mx-auto grid max-w-md grid-cols-4 md:max-w-7xl">
```

**Step 3: Add PRs icon in the template**

Add after the timers icon block:

```svelte
{:else if item.icon === 'prs'}
	<svg
		class="h-6 w-6 transition-transform duration-300 {active
			? 'scale-110 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]'
			: ''}"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
	>
		<path
			d="M12 15l-2 5h4l-2-5z"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path
			d="M8 8a4 4 0 1 1 8 0c0 2.5-2 3-2 5h-4c0-2-2-2.5-2-5z"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
```

**Step 4: Commit**

```bash
git add src/lib/components/BottomNav.svelte
git commit -m "feat(pr): add PRs to bottom navigation"
```

---

## Task 8: Create PR Page Layout and Server Load

**Files:**
- Create: `src/routes/(app)/prs/+page.server.ts`
- Create: `src/routes/(app)/prs/+page.svelte`

**Step 1: Create server load function**

Create `src/routes/(app)/prs/+page.server.ts`:

```typescript
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { exercise, personalRecord, user } from '$lib/server/db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import { seedExercises } from '$lib/server/db/seed-exercises';
import type { ExerciseWithBestPR, UnitPreference } from '$lib/types/pr';

export const load: PageServerLoad = async ({ locals }) => {
	// Ensure exercises are seeded
	await seedExercises();

	// Get all exercises
	const exercises = await db
		.select()
		.from(exercise)
		.orderBy(asc(exercise.sortOrder));

	// Get user's PRs
	const prs = locals.user
		? await db
				.select()
				.from(personalRecord)
				.where(eq(personalRecord.userId, locals.user.id))
		: [];

	// Get user's unit preference
	let unitPreference: UnitPreference = 'metric';
	if (locals.user) {
		const [userData] = await db
			.select({ unitPreference: user.unitPreference })
			.from(user)
			.where(eq(user.id, locals.user.id));
		unitPreference = (userData?.unitPreference as UnitPreference) ?? 'metric';
	}

	// Group PRs by exercise and find the best for each
	const prsByExercise = new Map<string, { value: number; date: string }>();
	for (const pr of prs) {
		const ex = exercises.find((e) => e.id === pr.exerciseId);
		if (!ex) continue;

		const existing = prsByExercise.get(pr.exerciseId);
		const isBetter =
			!existing ||
			(ex.measurementType === 'time'
				? pr.value < existing.value
				: pr.value > existing.value);

		if (isBetter) {
			prsByExercise.set(pr.exerciseId, { value: pr.value, date: pr.date });
		}
	}

	// Combine exercises with their best PR
	const exercisesWithPRs: ExerciseWithBestPR[] = exercises.map((ex) => ({
		...ex,
		bestPR: prsByExercise.get(ex.id) ?? null
	}));

	return {
		exercises: exercisesWithPRs,
		unitPreference
	};
};
```

**Step 2: Create basic page structure**

Create `src/routes/(app)/prs/+page.svelte`:

```svelte
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
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

	let { data }: { data: PageData } = $props();

	// State
	let searchQuery = $state('');
	let activeCategory = $state<ExerciseCategory>('weightlifting');
	let selectedExercise = $state<ExerciseWithBestPR | null>(null);
	let modalOpen = $state(false);

	// Derived
	let filteredExercises = $derived.by(() => {
		let result = data.exercises;

		// Filter by search
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter((ex) => ex.name.toLowerCase().includes(query));
		} else {
			// Filter by category only when not searching
			result = result.filter((ex) => ex.category === activeCategory);
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
		await invalidateAll();
		toastStore.success('PR saved!');
	}

	async function handlePRDeleted() {
		await invalidateAll();
		toastStore.success('PR deleted');
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

<Toast />

{#if selectedExercise}
	<PRModal
		bind:open={modalOpen}
		exercise={selectedExercise}
		unitPreference={data.unitPreference}
		onClose={handleModalClose}
		onSaved={handlePRSaved}
		onDeleted={handlePRDeleted}
	/>
{/if}

<div class="flex flex-col gap-6 p-4 pb-24 md:p-6">
	<!-- Header -->
	<header class="border-b border-white/10 pb-4">
		<h1
			class="bg-gradient-to-r from-white to-white/50 bg-clip-text text-3xl font-black tracking-tight text-transparent uppercase"
		>
			Personal Records
		</h1>
		<div class="h-1 w-16 bg-gradient-to-r from-accent-500 to-primary-500"></div>
	</header>

	<!-- Search Bar -->
	<div class="relative">
		<svg
			class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<circle cx="11" cy="11" r="8" />
			<path d="m21 21-4.3-4.3" />
		</svg>
		<input
			type="text"
			placeholder="Search exercises..."
			bind:value={searchQuery}
			class="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-white placeholder-text-muted outline-none focus:border-accent-500/50 focus:bg-white/10"
		/>
	</div>

	<!-- Category Tabs (hidden when searching) -->
	{#if !isSearching}
		<div class="flex gap-2 overflow-x-auto pb-2">
			{#each EXERCISE_CATEGORIES as category}
				<button
					onclick={() => (activeCategory = category)}
					class="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold uppercase transition-all {activeCategory ===
					category
						? 'bg-accent-500 text-white'
						: 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'}"
				>
					{categoryLabels[category]}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Exercise Grid -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
		{#each filteredExercises as exercise (exercise.id)}
			<button
				onclick={() => handleExerciseClick(exercise)}
				class="group relative overflow-hidden rounded-xl border border-white/5 bg-white/5 p-4 text-left transition-all hover:border-accent-500/30 hover:bg-white/10"
			>
				<h3 class="font-bold text-white line-clamp-2">{exercise.name}</h3>
				{#if exercise.bestPR}
					<p class="mt-2 text-lg font-black text-accent-400">
						{formatPRValue(exercise.bestPR.value, exercise.measurementType, data.unitPreference)}
					</p>
					<p class="text-xs text-text-muted">{formatDate(exercise.bestPR.date)}</p>
				{:else}
					<p class="mt-2 text-sm text-text-muted">No PR yet</p>
				{/if}

				<!-- Hover indicator -->
				<div
					class="absolute bottom-0 left-0 h-1 w-0 bg-accent-500 transition-all group-hover:w-full"
				></div>
			</button>
		{/each}
	</div>

	<!-- Empty state -->
	{#if filteredExercises.length === 0}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<p class="text-text-muted">
				{isSearching ? 'No exercises found' : 'No exercises in this category'}
			</p>
		</div>
	{/if}
</div>
```

**Step 3: Commit**

```bash
git add src/routes/\(app\)/prs/+page.server.ts src/routes/\(app\)/prs/+page.svelte
git commit -m "feat(pr): add PR page with category tabs and exercise grid"
```

---

## Task 9: Create PR Modal Component

**Files:**
- Create: `src/routes/(app)/prs/PRModal.svelte`

**Step 1: Create the modal component**

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$lib/components/Button.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import {
		formatPRValue,
		formatTime,
		parseTime,
		convertWeightForDisplay,
		convertWeightForStorage,
		convertDistanceForDisplay,
		convertDistanceForStorage,
		getWeightUnit,
		getDistanceUnit,
		isBetterPR,
		type ExerciseWithBestPR,
		type UnitPreference,
		type PersonalRecord
	} from '$lib/types/pr';

	interface Props {
		open: boolean;
		exercise: ExerciseWithBestPR;
		unitPreference: UnitPreference;
		onClose: () => void;
		onSaved: () => void;
		onDeleted: () => void;
	}

	let { open = $bindable(), exercise, unitPreference, onClose, onSaved, onDeleted }: Props =
		$props();

	// State
	let history = $state<PersonalRecord[]>([]);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let showNoteField = $state(false);
	let deleteModalOpen = $state(false);
	let prToDelete = $state<string | null>(null);

	// Form state
	let inputValue = $state('');
	let inputDate = $state(new Date().toISOString().split('T')[0]);
	let inputNote = $state('');

	// Dialog ref
	let dialogElement: HTMLDialogElement;

	// Load history when exercise changes
	$effect(() => {
		if (open && exercise) {
			loadHistory();
		}
	});

	// Handle dialog open/close
	$effect(() => {
		if (!dialogElement) return;

		if (open) {
			dialogElement.showModal();
			resetForm();
		} else {
			dialogElement.close();
		}
	});

	async function loadHistory() {
		isLoading = true;
		try {
			const res = await fetch(`/api/prs?exerciseId=${exercise.id}`);
			if (res.ok) {
				history = await res.json();
			}
		} catch (error) {
			console.error('Failed to load PR history:', error);
		}
		isLoading = false;
	}

	function resetForm() {
		inputValue = '';
		inputDate = new Date().toISOString().split('T')[0];
		inputNote = '';
		showNoteField = false;
	}

	function handleClose() {
		open = false;
		onClose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialogElement) {
			handleClose();
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!inputValue.trim()) return;

		isSaving = true;
		try {
			// Convert input value to storage format
			let storageValue: number;
			switch (exercise.measurementType) {
				case 'weight':
					storageValue = convertWeightForStorage(parseFloat(inputValue), unitPreference);
					break;
				case 'distance':
					storageValue = convertDistanceForStorage(parseFloat(inputValue), unitPreference);
					break;
				case 'time':
					storageValue = parseTime(inputValue);
					break;
				case 'reps':
					storageValue = parseInt(inputValue);
					break;
			}

			const res = await fetch('/api/prs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					exerciseId: exercise.id,
					value: storageValue,
					date: inputDate,
					note: inputNote.trim() || null
				})
			});

			if (res.ok) {
				resetForm();
				await loadHistory();
				onSaved();
			}
		} catch (error) {
			console.error('Failed to save PR:', error);
		}
		isSaving = false;
	}

	function handleDeleteClick(prId: string) {
		prToDelete = prId;
		deleteModalOpen = true;
	}

	async function confirmDelete() {
		if (!prToDelete) return;

		try {
			const res = await fetch(`/api/prs/${prToDelete}`, { method: 'DELETE' });
			if (res.ok) {
				await loadHistory();
				onDeleted();
			}
		} catch (error) {
			console.error('Failed to delete PR:', error);
		}
		deleteModalOpen = false;
		prToDelete = null;
	}

	function cancelDelete() {
		deleteModalOpen = false;
		prToDelete = null;
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getInputPlaceholder(): string {
		switch (exercise.measurementType) {
			case 'weight':
				return `e.g., 100 (${getWeightUnit(unitPreference)})`;
			case 'time':
				return 'e.g., 5:30 or 1:23:45';
			case 'reps':
				return 'e.g., 25';
			case 'distance':
				return `e.g., 5000 (${getDistanceUnit(unitPreference)})`;
		}
	}

	function getInputLabel(): string {
		switch (exercise.measurementType) {
			case 'weight':
				return `Weight (${getWeightUnit(unitPreference)})`;
			case 'time':
				return 'Time (mm:ss)';
			case 'reps':
				return 'Reps';
			case 'distance':
				return `Distance (${getDistanceUnit(unitPreference)})`;
		}
	}

	// Find best PR in history
	let bestPR = $derived.by(() => {
		if (history.length === 0) return null;

		return history.reduce((best, pr) => {
			if (!best) return pr;
			return isBetterPR(pr.value, best.value, exercise.measurementType) ? pr : best;
		}, null as PersonalRecord | null);
	});

	const categoryLabels: Record<string, string> = {
		weightlifting: 'Weightlifting',
		benchmark: 'Benchmark',
		gymnastics: 'Gymnastics',
		cardio: 'Cardio'
	};

	const measurementLabels: Record<string, string> = {
		weight: 'Weight',
		time: 'Time',
		reps: 'Reps',
		distance: 'Distance'
	};
</script>

<ConfirmModal
	bind:open={deleteModalOpen}
	title="Delete PR"
	message="Are you sure you want to delete this PR entry? This cannot be undone."
	confirmText="Delete"
	cancelText="Cancel"
	variant="danger"
	onConfirm={confirmDelete}
	onCancel={cancelDelete}
/>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialogElement}
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && handleClose()}
	class="m-0 h-full max-h-full w-full max-w-full bg-transparent p-0 md:m-auto md:h-auto md:max-h-[85vh] md:max-w-lg md:rounded-2xl"
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		onclick={(e) => e.stopPropagation()}
		class="flex h-full flex-col bg-bg-surface md:max-h-[85vh] md:rounded-2xl md:border md:border-white/10"
	>
		<!-- Header -->
		<div class="border-b border-white/10 p-4">
			<div class="flex items-start justify-between">
				<div>
					<h2 class="text-xl font-black text-white">{exercise.name}</h2>
					<p class="text-sm text-text-muted">
						{categoryLabels[exercise.category]} · {measurementLabels[exercise.measurementType]}
					</p>
				</div>
				<button
					onclick={handleClose}
					class="rounded-lg p-2 text-text-muted hover:bg-white/10 hover:text-white"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-4">
			<!-- Add PR Form -->
			<form onsubmit={handleSubmit} class="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
				<h3 class="mb-4 text-sm font-bold uppercase text-text-secondary">Log New PR</h3>

				<div class="flex gap-3">
					<div class="flex-1">
						<label for="pr-value" class="mb-1 block text-xs font-bold text-text-muted">
							{getInputLabel()}
						</label>
						<input
							id="pr-value"
							type={exercise.measurementType === 'time' ? 'text' : 'number'}
							step={exercise.measurementType === 'weight' || exercise.measurementType === 'distance'
								? '0.01'
								: '1'}
							placeholder={getInputPlaceholder()}
							bind:value={inputValue}
							required
							class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-text-muted outline-none focus:border-accent-500/50"
						/>
					</div>
					<div class="w-32">
						<label for="pr-date" class="mb-1 block text-xs font-bold text-text-muted">Date</label>
						<input
							id="pr-date"
							type="date"
							bind:value={inputDate}
							required
							class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-accent-500/50"
						/>
					</div>
				</div>

				{#if showNoteField}
					<div class="mt-3">
						<label for="pr-note" class="mb-1 block text-xs font-bold text-text-muted">Note</label>
						<input
							id="pr-note"
							type="text"
							placeholder="e.g., Felt strong, competition PR..."
							bind:value={inputNote}
							maxlength="500"
							class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-text-muted outline-none focus:border-accent-500/50"
						/>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => (showNoteField = true)}
						class="mt-2 text-xs text-accent-400 hover:underline"
					>
						+ Add note
					</button>
				{/if}

				<div class="mt-4">
					<Button type="submit" variant="primary" class="w-full" disabled={isSaving}>
						{isSaving ? 'Saving...' : 'Save PR'}
					</Button>
				</div>
			</form>

			<!-- History -->
			<div>
				<h3 class="mb-3 text-sm font-bold uppercase text-text-secondary">History</h3>

				{#if isLoading}
					<div class="space-y-2">
						{#each Array(3) as _}
							<div class="h-16 animate-pulse rounded-lg bg-white/5"></div>
						{/each}
					</div>
				{:else if history.length === 0}
					<p class="text-center text-sm text-text-muted py-8">No PRs logged yet</p>
				{:else}
					<div class="space-y-2">
						{#each history as pr (pr.id)}
							{@const isBest = bestPR?.id === pr.id}
							<div
								class="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3 {isBest
									? 'border-accent-500/30 bg-accent-500/10'
									: ''}"
							>
								<div class="flex items-center gap-3">
									{#if isBest}
										<span class="text-xl">🏆</span>
									{/if}
									<div>
										<p class="font-bold text-white">
											{formatPRValue(pr.value, exercise.measurementType, unitPreference)}
										</p>
										<p class="text-xs text-text-muted">
											{formatDate(pr.date)}
											{#if pr.note}
												<span class="text-text-secondary"> · "{pr.note}"</span>
											{/if}
										</p>
									</div>
								</div>
								<button
									onclick={() => handleDeleteClick(pr.id)}
									class="rounded-lg p-2 text-text-muted hover:bg-error/10 hover:text-error"
									title="Delete"
								>
									<svg
										class="h-4 w-4"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<polyline points="3 6 5 6 21 6" />
										<path
											d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
										/>
									</svg>
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</dialog>

<style>
	dialog::backdrop {
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(4px);
	}

	dialog[open] {
		animation: slide-up 0.2s ease-out;
	}

	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
```

**Step 2: Commit**

```bash
git add src/routes/\(app\)/prs/PRModal.svelte
git commit -m "feat(pr): add PR modal with history and add form"
```

---

## Task 10: Add Settings Page for Unit Preference

**Files:**
- Create: `src/routes/(app)/settings/+page.svelte`
- Create: `src/routes/(app)/settings/+page.server.ts`

**Step 1: Create settings page server load**

Create `src/routes/(app)/settings/+page.server.ts`:

```typescript
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { unitPreference: 'metric' };
	}

	const [userData] = await db
		.select({ unitPreference: user.unitPreference })
		.from(user)
		.where(eq(user.id, locals.user.id));

	return {
		unitPreference: userData?.unitPreference ?? 'metric'
	};
};
```

**Step 2: Create settings page**

Create `src/routes/(app)/settings/+page.svelte`:

```svelte
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Card from '$lib/components/Card.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let unitPreference = $state(data.unitPreference);
	let isSaving = $state(false);

	async function handleUnitChange(newUnit: 'metric' | 'imperial') {
		if (newUnit === unitPreference) return;

		isSaving = true;
		try {
			const res = await fetch('/api/user/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ unitPreference: newUnit })
			});

			if (res.ok) {
				unitPreference = newUnit;
				await invalidateAll();
				toastStore.success('Settings saved');
			} else {
				toastStore.error('Failed to save settings');
			}
		} catch (error) {
			console.error('Failed to save settings:', error);
			toastStore.error('Failed to save settings');
		}
		isSaving = false;
	}
</script>

<Toast />

<div class="flex flex-col gap-6 p-4 pb-24 md:p-6">
	<!-- Header -->
	<header class="border-b border-white/10 pb-4">
		<h1
			class="bg-gradient-to-r from-white to-white/50 bg-clip-text text-3xl font-black tracking-tight text-transparent uppercase"
		>
			Settings
		</h1>
		<div class="h-1 w-16 bg-gradient-to-r from-accent-500 to-primary-500"></div>
	</header>

	<!-- Unit Preference -->
	<Card>
		<h2 class="mb-4 text-lg font-bold text-white">Units</h2>
		<p class="mb-4 text-sm text-text-muted">
			Choose your preferred measurement system for Personal Records.
		</p>

		<div class="flex gap-4">
			<button
				onclick={() => handleUnitChange('metric')}
				disabled={isSaving}
				class="flex-1 rounded-lg border-2 p-4 text-left transition-all {unitPreference === 'metric'
					? 'border-accent-500 bg-accent-500/10'
					: 'border-white/10 bg-white/5 hover:border-white/20'}"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-5 w-5 items-center justify-center rounded-full border-2 {unitPreference ===
						'metric'
							? 'border-accent-500'
							: 'border-white/30'}"
					>
						{#if unitPreference === 'metric'}
							<div class="h-2.5 w-2.5 rounded-full bg-accent-500"></div>
						{/if}
					</div>
					<div>
						<p class="font-bold text-white">Metric</p>
						<p class="text-xs text-text-muted">kg, meters</p>
					</div>
				</div>
			</button>

			<button
				onclick={() => handleUnitChange('imperial')}
				disabled={isSaving}
				class="flex-1 rounded-lg border-2 p-4 text-left transition-all {unitPreference ===
				'imperial'
					? 'border-accent-500 bg-accent-500/10'
					: 'border-white/10 bg-white/5 hover:border-white/20'}"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-5 w-5 items-center justify-center rounded-full border-2 {unitPreference ===
						'imperial'
							? 'border-accent-500'
							: 'border-white/30'}"
					>
						{#if unitPreference === 'imperial'}
							<div class="h-2.5 w-2.5 rounded-full bg-accent-500"></div>
						{/if}
					</div>
					<div>
						<p class="font-bold text-white">Imperial</p>
						<p class="text-xs text-text-muted">lbs, miles</p>
					</div>
				</div>
			</button>
		</div>
	</Card>

	<!-- Link to Workspace Settings -->
	<Card>
		<h2 class="mb-2 text-lg font-bold text-white">Workspace</h2>
		<p class="mb-4 text-sm text-text-muted">Manage workspace members and invitations.</p>
		<a
			href="/settings/workspace"
			class="inline-flex items-center gap-2 text-sm font-bold text-accent-400 hover:underline"
		>
			Workspace Settings
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</a>
	</Card>
</div>
```

**Step 3: Commit**

```bash
git add src/routes/\(app\)/settings/+page.svelte src/routes/\(app\)/settings/+page.server.ts
git commit -m "feat(pr): add settings page with unit preference"
```

---

## Task 11: Add Settings Link to Navigation

**Files:**
- Modify: `src/routes/(app)/+layout.svelte`

**Step 1: Add settings icon link in header**

Add a settings link in the header, after the WorkspaceSwitcher:

```svelte
<div class="flex items-center gap-4">
	<div class="hidden sm:block">
		<WorkspaceSwitcher workspaces={data.workspaces} activeWorkspaceId={data.activeWorkspaceId} />
	</div>
	<a
		href="/settings"
		class="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/10 hover:text-white"
		title="Settings"
	>
		<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="3" />
			<path
				d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
			/>
		</svg>
	</a>
	<form action="/logout" method="POST">
		<button
			type="submit"
			class="glass-hover rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-xs font-bold tracking-wider text-text-muted uppercase transition-all hover:border-error/30 hover:bg-error/5 hover:text-error"
		>
			Logout
		</button>
	</form>
</div>
```

**Step 2: Commit**

```bash
git add src/routes/\(app\)/+layout.svelte
git commit -m "feat(pr): add settings link to header navigation"
```

---

## Task 12: Final Integration and Testing

**Step 1: Run database migration**

Run: `DATABASE_URL="file:local.db" bunx drizzle-kit push`
Expected: All tables updated successfully

**Step 2: Start dev server and test**

Run: `bun run dev`

Test checklist:
- [ ] Navigate to /prs - see category tabs and exercise grid
- [ ] Search for an exercise - tabs hide, results show
- [ ] Click an exercise - modal opens with history (empty)
- [ ] Add a PR - form submits, history updates
- [ ] Add PR with note - note displays in history
- [ ] Delete a PR - confirmation modal, PR removed
- [ ] Navigate to /settings - unit preference displayed
- [ ] Change unit preference - PRs display in new units
- [ ] Best PR shows trophy icon in history

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(pr): complete Personal Records feature implementation"
```

---

## Summary

Total tasks: 12
New files created: 10
Files modified: 3

Key features implemented:
1. Database schema with Exercise and PersonalRecord tables
2. Exercise seed data (42 predefined exercises)
3. Full type system with Zod validation
4. Unit conversion utilities (metric/imperial)
5. REST API endpoints for exercises and PRs
6. PR page with category tabs, search, and card grid
7. PR modal with history and add form
8. User settings page with unit preference
9. Navigation updates (bottom nav + header settings link)
