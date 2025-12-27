# Workspace Leaderboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add workspace leaderboard with points-based ranking and per-exercise PR comparisons

**Architecture:** Two new API endpoints compute leaderboard data from existing `personalRecord` + `workspaceMember` tables. Frontend adds a tab to the PRs page for the leaderboard view, plus rankings integration in the existing PR modal.

**Tech Stack:** SvelteKit, Drizzle ORM, Svelte 5 runes, TypeScript, Zod

---

## Task 1: Add Leaderboard Types

**Files:**
- Modify: `src/lib/types/pr.ts`

**Step 1: Add leaderboard type definitions**

Add these types at the end of the Type Definitions section (after `ExerciseWithBestPR`):

```typescript
// ============================================================================
// Leaderboard Types
// ============================================================================

export interface LeaderboardUser {
	userId: string;
	email: string;
	points: number;
	rank: number;
}

export interface ExerciseLeader {
	exerciseId: string;
	exerciseName: string;
	category: ExerciseCategory;
	measurementType: MeasurementType;
	leaders: Array<{
		userId: string;
		email: string;
		value: number;
		date: string;
	}>;
}

export interface LeaderboardResponse {
	rankings: LeaderboardUser[];
	exerciseLeaders: ExerciseLeader[];
	totalExercises: number;
	activeExercises: number;
	currentUserId: string;
}

export interface ExerciseRanking {
	rank: number;
	userId: string;
	email: string;
	value: number;
	date: string;
}

export interface ExerciseRankingsResponse {
	exercise: {
		id: string;
		name: string;
		category: ExerciseCategory;
		measurementType: MeasurementType;
	};
	rankings: ExerciseRanking[];
	totalMembers: number;
	membersWithPR: number;
	currentUserId: string;
}
```

**Step 2: Commit**

```bash
git add src/lib/types/pr.ts
git commit -m "feat(leaderboard): add leaderboard type definitions"
```

---

## Task 2: Create Leaderboard API Endpoint

**Files:**
- Create: `src/routes/api/workspaces/[id]/leaderboard/+server.ts`

**Step 1: Create the leaderboard endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workspaceMember, user, personalRecord, exercise } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type {
	LeaderboardResponse,
	LeaderboardUser,
	ExerciseLeader,
	MeasurementType,
	ExerciseCategory
} from '$lib/types/pr';

/**
 * GET /api/workspaces/[id]/leaderboard
 * Returns workspace leaderboard with points and exercise leaders
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id: workspaceId } = params;

	// Check if user is a member of this workspace
	const [membership] = await db
		.select()
		.from(workspaceMember)
		.where(
			and(eq(workspaceMember.userId, locals.user.id), eq(workspaceMember.workspaceId, workspaceId))
		);

	if (!membership) {
		return json({ error: 'Not a member of this workspace' }, { status: 403 });
	}

	// Get all workspace members
	const members = await db
		.select({
			userId: workspaceMember.userId,
			email: user.email
		})
		.from(workspaceMember)
		.innerJoin(user, eq(workspaceMember.userId, user.id))
		.where(eq(workspaceMember.workspaceId, workspaceId));

	const memberIds = members.map((m) => m.userId);
	const memberMap = new Map(members.map((m) => [m.userId, m.email]));

	// Get all exercises
	const exercises = await db.select().from(exercise);

	// Get all PRs for workspace members
	const allPRs =
		memberIds.length > 0
			? await db
					.select()
					.from(personalRecord)
					.where(inArray(personalRecord.userId, memberIds))
			: [];

	// Calculate best PR per user per exercise
	const bestPRs = new Map<string, Map<string, { value: number; date: string }>>();

	for (const pr of allPRs) {
		const ex = exercises.find((e) => e.id === pr.exerciseId);
		if (!ex) continue;

		if (!bestPRs.has(pr.exerciseId)) {
			bestPRs.set(pr.exerciseId, new Map());
		}

		const exercisePRs = bestPRs.get(pr.exerciseId)!;
		const existing = exercisePRs.get(pr.userId);

		const isBetter =
			!existing ||
			(ex.measurementType === 'time' ? pr.value < existing.value : pr.value > existing.value);

		if (isBetter) {
			exercisePRs.set(pr.userId, { value: pr.value, date: pr.date });
		}
	}

	// Calculate points per user and track exercise leaders
	const pointsMap = new Map<string, number>();
	const exerciseLeaders: ExerciseLeader[] = [];

	// Initialize all members with 0 points
	for (const userId of memberIds) {
		pointsMap.set(userId, 0);
	}

	// For each exercise, find the leader(s)
	for (const ex of exercises) {
		const exercisePRs = bestPRs.get(ex.id);

		const leaders: ExerciseLeader['leaders'] = [];

		if (exercisePRs && exercisePRs.size > 0) {
			// Find the best value for this exercise
			let bestValue: number | null = null;

			for (const [userId, pr] of exercisePRs) {
				if (bestValue === null) {
					bestValue = pr.value;
				} else if (ex.measurementType === 'time') {
					bestValue = Math.min(bestValue, pr.value);
				} else {
					bestValue = Math.max(bestValue, pr.value);
				}
			}

			// Award points to everyone with the best value (ties)
			for (const [userId, pr] of exercisePRs) {
				if (pr.value === bestValue) {
					pointsMap.set(userId, (pointsMap.get(userId) || 0) + 1);
					leaders.push({
						userId,
						email: memberMap.get(userId) || '',
						value: pr.value,
						date: pr.date
					});
				}
			}
		}

		exerciseLeaders.push({
			exerciseId: ex.id,
			exerciseName: ex.name,
			category: ex.category as ExerciseCategory,
			measurementType: ex.measurementType as MeasurementType,
			leaders
		});
	}

	// Sort users by points (descending), then by email for stable ordering
	const rankings: LeaderboardUser[] = members
		.map((m) => ({
			userId: m.userId,
			email: m.email,
			points: pointsMap.get(m.userId) || 0,
			rank: 0
		}))
		.sort((a, b) => {
			if (b.points !== a.points) return b.points - a.points;
			return a.email.localeCompare(b.email);
		});

	// Assign ranks (same rank for ties)
	let currentRank = 1;
	for (let i = 0; i < rankings.length; i++) {
		if (i > 0 && rankings[i].points < rankings[i - 1].points) {
			currentRank = i + 1;
		}
		rankings[i].rank = currentRank;
	}

	// Count active exercises (exercises with at least one PR)
	const activeExercises = exerciseLeaders.filter((e) => e.leaders.length > 0).length;

	const response: LeaderboardResponse = {
		rankings,
		exerciseLeaders,
		totalExercises: exercises.length,
		activeExercises,
		currentUserId: locals.user.id
	};

	return json(response);
};
```

**Step 2: Commit**

```bash
git add src/routes/api/workspaces/[id]/leaderboard/+server.ts
git commit -m "feat(leaderboard): add leaderboard API endpoint"
```

---

## Task 3: Create Exercise Rankings API Endpoint

**Files:**
- Create: `src/routes/api/workspaces/[id]/exercises/[exerciseId]/rankings/+server.ts`

**Step 1: Create the exercise rankings endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workspaceMember, user, personalRecord, exercise } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { ExerciseRankingsResponse, ExerciseRanking, ExerciseCategory, MeasurementType } from '$lib/types/pr';

/**
 * GET /api/workspaces/[id]/exercises/[exerciseId]/rankings
 * Returns rankings for a specific exercise within a workspace
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id: workspaceId, exerciseId } = params;

	// Check if user is a member of this workspace
	const [membership] = await db
		.select()
		.from(workspaceMember)
		.where(
			and(eq(workspaceMember.userId, locals.user.id), eq(workspaceMember.workspaceId, workspaceId))
		);

	if (!membership) {
		return json({ error: 'Not a member of this workspace' }, { status: 403 });
	}

	// Get the exercise
	const [ex] = await db.select().from(exercise).where(eq(exercise.id, exerciseId));

	if (!ex) {
		return json({ error: 'Exercise not found' }, { status: 404 });
	}

	// Get all workspace members
	const members = await db
		.select({
			userId: workspaceMember.userId,
			email: user.email
		})
		.from(workspaceMember)
		.innerJoin(user, eq(workspaceMember.userId, user.id))
		.where(eq(workspaceMember.workspaceId, workspaceId));

	const memberIds = members.map((m) => m.userId);
	const memberMap = new Map(members.map((m) => [m.userId, m.email]));

	// Get all PRs for this exercise from workspace members
	const prs =
		memberIds.length > 0
			? await db
					.select()
					.from(personalRecord)
					.where(
						and(
							eq(personalRecord.exerciseId, exerciseId),
							inArray(personalRecord.userId, memberIds)
						)
					)
			: [];

	// Find best PR per user
	const bestPRs = new Map<string, { value: number; date: string }>();

	for (const pr of prs) {
		const existing = bestPRs.get(pr.userId);
		const isBetter =
			!existing ||
			(ex.measurementType === 'time' ? pr.value < existing.value : pr.value > existing.value);

		if (isBetter) {
			bestPRs.set(pr.userId, { value: pr.value, date: pr.date });
		}
	}

	// Create rankings array
	const rankings: ExerciseRanking[] = [];

	for (const [userId, pr] of bestPRs) {
		rankings.push({
			rank: 0,
			userId,
			email: memberMap.get(userId) || '',
			value: pr.value,
			date: pr.date
		});
	}

	// Sort by value (ascending for time, descending for others)
	rankings.sort((a, b) => {
		if (ex.measurementType === 'time') {
			return a.value - b.value;
		}
		return b.value - a.value;
	});

	// Assign ranks (same rank for ties)
	let currentRank = 1;
	for (let i = 0; i < rankings.length; i++) {
		if (i > 0 && rankings[i].value !== rankings[i - 1].value) {
			currentRank = i + 1;
		}
		rankings[i].rank = currentRank;
	}

	const response: ExerciseRankingsResponse = {
		exercise: {
			id: ex.id,
			name: ex.name,
			category: ex.category as ExerciseCategory,
			measurementType: ex.measurementType as MeasurementType
		},
		rankings,
		totalMembers: members.length,
		membersWithPR: bestPRs.size,
		currentUserId: locals.user.id
	};

	return json(response);
};
```

**Step 2: Commit**

```bash
git add src/routes/api/workspaces/[id]/exercises/[exerciseId]/rankings/+server.ts
git commit -m "feat(leaderboard): add exercise rankings API endpoint"
```

---

## Task 4: Create Exercise Ranking Modal Component

**Files:**
- Create: `src/routes/(app)/prs/ExerciseRankingModal.svelte`

**Step 1: Create the exercise ranking modal**

```svelte
<script lang="ts">
	import { formatPRValue, type ExerciseRankingsResponse, type UnitPreference } from '$lib/types/pr';

	interface Props {
		open: boolean;
		data: ExerciseRankingsResponse | null;
		unitPreference: UnitPreference;
		onClose: () => void;
	}

	let { open = $bindable(), data, unitPreference, onClose }: Props = $props();

	let dialogElement: HTMLDialogElement;

	$effect(() => {
		if (!dialogElement) return;

		if (open && data) {
			dialogElement.showModal();
		} else {
			dialogElement.close();
		}
	});

	function handleClose() {
		open = false;
		onClose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialogElement) {
			handleClose();
		}
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getRankEmoji(rank: number): string {
		if (rank === 1) return '🥇';
		if (rank === 2) return '🥈';
		if (rank === 3) return '🥉';
		return `#${rank}`;
	}

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

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialogElement}
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && handleClose()}
	class="m-0 h-full max-h-full w-full max-w-full bg-transparent p-0 md:m-auto md:h-auto md:max-h-[85vh] md:max-w-lg md:rounded-2xl"
>
	{#if data}
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
						<h2 class="text-xl font-black text-white">{data.exercise.name} Rankings</h2>
						<p class="text-sm text-text-muted">
							{categoryLabels[data.exercise.category]} · {measurementLabels[data.exercise.measurementType]}
						</p>
					</div>
					<button
						onclick={handleClose}
						aria-label="Close"
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
				{#if data.rankings.length === 0}
					<p class="py-8 text-center text-sm text-text-muted">No PRs logged yet for this exercise</p>
				{:else}
					<div class="space-y-2">
						{#each data.rankings as entry (entry.userId)}
							{@const isCurrentUser = entry.userId === data.currentUserId}
							<div
								class="flex items-center justify-between rounded-lg border p-3 {isCurrentUser
									? 'border-accent-500/30 bg-accent-500/10'
									: 'border-white/5 bg-white/5'}"
							>
								<div class="flex items-center gap-3">
									<span class="w-8 text-center text-lg font-bold {entry.rank <= 3 ? '' : 'text-text-muted'}">
										{getRankEmoji(entry.rank)}
									</span>
									<div>
										<p class="font-bold text-white">
											{isCurrentUser ? 'You' : entry.email.split('@')[0]}
										</p>
										<p class="text-xs text-text-muted">{formatDate(entry.date)}</p>
									</div>
								</div>
								<p class="text-lg font-black text-accent-400">
									{formatPRValue(entry.value, data.exercise.measurementType, unitPreference)}
								</p>
							</div>
						{/each}
					</div>

					{#if data.totalMembers > data.membersWithPR}
						<p class="mt-4 text-center text-sm text-text-muted">
							{data.totalMembers - data.membersWithPR} member{data.totalMembers - data.membersWithPR !== 1 ? 's' : ''} haven't logged this exercise yet
						</p>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
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
git add src/routes/(app)/prs/ExerciseRankingModal.svelte
git commit -m "feat(leaderboard): add exercise ranking modal component"
```

---

## Task 5: Create Leaderboard Tab Component

**Files:**
- Create: `src/routes/(app)/prs/LeaderboardTab.svelte`

**Step 1: Create the leaderboard tab component**

```svelte
<script lang="ts">
	import {
		formatPRValue,
		type LeaderboardResponse,
		type ExerciseRankingsResponse,
		type UnitPreference
	} from '$lib/types/pr';
	import ExerciseRankingModal from './ExerciseRankingModal.svelte';

	interface Props {
		workspaceId: string;
		unitPreference: UnitPreference;
	}

	let { workspaceId, unitPreference }: Props = $props();

	let leaderboard = $state<LeaderboardResponse | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// Modal state
	let rankingModalOpen = $state(false);
	let selectedExerciseRankings = $state<ExerciseRankingsResponse | null>(null);
	let loadingExerciseId = $state<string | null>(null);

	$effect(() => {
		loadLeaderboard();
	});

	async function loadLeaderboard() {
		isLoading = true;
		error = null;
		try {
			const res = await fetch(`/api/workspaces/${workspaceId}/leaderboard`);
			if (res.ok) {
				leaderboard = await res.json();
			} else {
				error = 'Failed to load leaderboard';
			}
		} catch (e) {
			error = 'Failed to load leaderboard';
			console.error(e);
		}
		isLoading = false;
	}

	async function openExerciseRankings(exerciseId: string) {
		loadingExerciseId = exerciseId;
		try {
			const res = await fetch(`/api/workspaces/${workspaceId}/exercises/${exerciseId}/rankings`);
			if (res.ok) {
				selectedExerciseRankings = await res.json();
				rankingModalOpen = true;
			}
		} catch (e) {
			console.error(e);
		}
		loadingExerciseId = null;
	}

	function closeRankingModal() {
		rankingModalOpen = false;
		selectedExerciseRankings = null;
	}

	function getRankDisplay(rank: number): string {
		if (rank === 1) return '🥇';
		if (rank === 2) return '🥈';
		if (rank === 3) return '🥉';
		return `#${rank}`;
	}

	// Calculate max points for progress bar scaling
	let maxPoints = $derived(
		leaderboard ? Math.max(...leaderboard.rankings.map((r) => r.points), 1) : 1
	);
</script>

<ExerciseRankingModal
	bind:open={rankingModalOpen}
	data={selectedExerciseRankings}
	{unitPreference}
	onClose={closeRankingModal}
/>

{#if isLoading}
	<div class="space-y-4">
		<div class="h-8 w-48 animate-pulse rounded bg-white/5"></div>
		{#each Array(5) as _}
			<div class="h-16 animate-pulse rounded-lg bg-white/5"></div>
		{/each}
	</div>
{:else if error}
	<div class="py-12 text-center">
		<p class="text-text-muted">{error}</p>
		<button onclick={loadLeaderboard} class="mt-4 text-accent-400 hover:underline">
			Try again
		</button>
	</div>
{:else if leaderboard}
	<div class="space-y-6">
		<!-- Rankings Section -->
		<section>
			<h2 class="mb-4 flex items-center gap-2 text-lg font-black text-white">
				<span>🏆</span> Workspace Leaderboard
			</h2>

			{#if leaderboard.rankings.length === 0}
				<p class="py-8 text-center text-text-muted">No members in this workspace yet</p>
			{:else}
				<div class="space-y-2">
					{#each leaderboard.rankings as user (user.userId)}
						{@const isCurrentUser = user.userId === leaderboard.currentUserId}
						<div
							class="flex items-center gap-4 rounded-lg border p-3 {isCurrentUser
								? 'border-accent-500/30 bg-accent-500/10'
								: 'border-white/5 bg-white/5'}"
						>
							<span class="w-10 text-center text-lg font-bold {user.rank <= 3 ? '' : 'text-text-muted'}">
								{getRankDisplay(user.rank)}
							</span>
							<div class="flex-1">
								<p class="font-bold text-white">
									{isCurrentUser ? 'You' : user.email.split('@')[0]}
								</p>
								<div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
									<div
										class="h-full rounded-full bg-gradient-to-r from-accent-500 to-primary-500 transition-all"
										style="width: {(user.points / maxPoints) * 100}%"
									></div>
								</div>
							</div>
							<span class="text-lg font-black text-accent-400">
								{user.points} pt{user.points !== 1 ? 's' : ''}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Exercise Breakdown Section -->
		<section>
			<h2 class="mb-4 text-lg font-black text-white">Exercise Breakdown</h2>
			<p class="mb-4 text-sm text-text-muted">
				{leaderboard.activeExercises} of {leaderboard.totalExercises} exercises have PRs logged
			</p>

			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{#each leaderboard.exerciseLeaders as exercise (exercise.exerciseId)}
					{@const hasLeaders = exercise.leaders.length > 0}
					{@const isLoading = loadingExerciseId === exercise.exerciseId}
					<button
						onclick={() => openExerciseRankings(exercise.exerciseId)}
						disabled={isLoading}
						class="group relative overflow-hidden rounded-xl border p-4 text-left transition-all {hasLeaders
							? 'border-white/5 bg-white/5 hover:border-accent-500/30 hover:bg-white/10'
							: 'border-white/5 bg-white/[0.02] hover:bg-white/5'}"
					>
						<h3 class="font-bold text-white line-clamp-2">{exercise.exerciseName}</h3>

						{#if hasLeaders}
							{@const leader = exercise.leaders[0]}
							{@const isCurrentUserLeader = leader.userId === leaderboard.currentUserId}
							<p class="mt-2 text-sm text-accent-400">
								🥇 {isCurrentUserLeader ? 'You' : leader.email.split('@')[0]}
							</p>
							<p class="text-lg font-black text-white">
								{formatPRValue(leader.value, exercise.measurementType, unitPreference)}
							</p>
							{#if exercise.leaders.length > 1}
								<p class="text-xs text-text-muted">+{exercise.leaders.length - 1} tied</p>
							{/if}
						{:else}
							<p class="mt-2 text-sm text-text-muted">No PRs yet</p>
							<p class="text-xs text-text-muted">Be the first!</p>
						{/if}

						{#if isLoading}
							<div class="absolute inset-0 flex items-center justify-center bg-black/50">
								<div class="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent"></div>
							</div>
						{/if}

						<div
							class="absolute bottom-0 left-0 h-1 w-0 bg-accent-500 transition-all group-hover:w-full"
						></div>
					</button>
				{/each}
			</div>
		</section>
	</div>
{/if}
```

**Step 2: Commit**

```bash
git add src/routes/(app)/prs/LeaderboardTab.svelte
git commit -m "feat(leaderboard): add leaderboard tab component"
```

---

## Task 6: Update PRs Page with Tabs

**Files:**
- Modify: `src/routes/(app)/prs/+page.svelte`
- Modify: `src/routes/(app)/prs/+page.server.ts`

**Step 1: Update page server to include activeWorkspaceId**

In `src/routes/(app)/prs/+page.server.ts`, add `activeWorkspaceId` to the return:

```typescript
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { exercise, personalRecord, user } from '$lib/server/db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import { seedExercises } from '$lib/server/db/seed-exercises';
import type { ExerciseWithBestPR, UnitPreference, ExerciseCategory, MeasurementType } from '$lib/types/pr';

export const load: PageServerLoad = async ({ locals, parent }) => {
	// Get activeWorkspaceId from parent layout
	const { activeWorkspaceId } = await parent();

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
		id: ex.id,
		name: ex.name,
		category: ex.category as ExerciseCategory,
		measurementType: ex.measurementType as MeasurementType,
		sortOrder: ex.sortOrder,
		bestPR: prsByExercise.get(ex.id) ?? null
	}));

	return {
		exercises: exercisesWithPRs,
		unitPreference,
		activeWorkspaceId
	};
};
```

**Step 2: Update page component with tabs**

Replace `src/routes/(app)/prs/+page.svelte` with:

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
	import ImportPRModal from './ImportPRModal.svelte';
	import LeaderboardTab from './LeaderboardTab.svelte';

	let { data }: { data: PageData } = $props();

	// Tab state
	type TabId = 'my-prs' | 'leaderboard';
	let activeTab = $state<TabId>('my-prs');

	// State
	let searchQuery = $state('');
	let activeCategory = $state<ExerciseCategory>('weightlifting');
	let selectedExercise = $state<ExerciseWithBestPR | null>(null);
	let modalOpen = $state(false);
	let importModalOpen = $state(false);

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

	async function handleImportSuccess() {
		await invalidateAll();
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

	const tabs: { id: TabId; label: string }[] = [
		{ id: 'my-prs', label: 'My PRs' },
		{ id: 'leaderboard', label: 'Leaderboard' }
	];
</script>

<Toast />

{#if selectedExercise}
	<PRModal
		bind:open={modalOpen}
		exercise={selectedExercise}
		unitPreference={data.unitPreference}
		workspaceId={data.activeWorkspaceId}
		onClose={handleModalClose}
		onSaved={handlePRSaved}
		onDeleted={handlePRDeleted}
	/>
{/if}

<ImportPRModal
	bind:open={importModalOpen}
	unitPreference={data.unitPreference}
	onClose={() => (importModalOpen = false)}
	onImported={handleImportSuccess}
/>

<div class="flex flex-col gap-6 p-4 pb-24 md:p-6">
	<!-- Header -->
	<header class="flex items-start justify-between border-b border-white/10 pb-4">
		<div>
			<h1
				class="bg-gradient-to-r from-white to-white/50 bg-clip-text text-3xl font-black tracking-tight text-transparent uppercase"
			>
				Personal Records
			</h1>
			<div class="h-1 w-16 bg-gradient-to-r from-accent-500 to-primary-500"></div>
		</div>
		{#if activeTab === 'my-prs'}
			<button
				onclick={() => (importModalOpen = true)}
				class="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-white/10 hover:text-white"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				Import
			</button>
		{/if}
	</header>

	<!-- Tab Navigation -->
	<div class="flex gap-2 border-b border-white/10">
		{#each tabs as tab}
			<button
				onclick={() => (activeTab = tab.id)}
				class="relative px-4 py-2 text-sm font-bold uppercase transition-colors {activeTab === tab.id
					? 'text-white'
					: 'text-text-muted hover:text-white'}"
			>
				{tab.label}
				{#if activeTab === tab.id}
					<div class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500"></div>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Tab Content -->
	{#if activeTab === 'my-prs'}
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
	{:else if activeTab === 'leaderboard'}
		{#if data.activeWorkspaceId}
			<LeaderboardTab workspaceId={data.activeWorkspaceId} unitPreference={data.unitPreference} />
		{:else}
			<div class="py-12 text-center">
				<p class="text-text-muted">No workspace selected</p>
			</div>
		{/if}
	{/if}
</div>
```

**Step 3: Commit**

```bash
git add src/routes/(app)/prs/+page.svelte src/routes/(app)/prs/+page.server.ts
git commit -m "feat(leaderboard): add tab navigation to PRs page"
```

---

## Task 7: Add Workspace Rankings to PR Modal

**Files:**
- Modify: `src/routes/(app)/prs/PRModal.svelte`

**Step 1: Update PRModal to include workspace rankings**

Add the workspace rankings section to the PR modal. Add these imports and state at the top of the script:

```typescript
// Add to imports
import type { ExerciseRankingsResponse } from '$lib/types/pr';

// Add to Props interface
workspaceId?: string;

// Update props destructuring to include workspaceId
let { open = $bindable(), exercise, unitPreference, workspaceId, onClose, onSaved, onDeleted }: Props = $props();

// Add new state
let rankings = $state<ExerciseRankingsResponse | null>(null);
let rankingsLoading = $state(false);
```

Add a function to load rankings:

```typescript
async function loadRankings() {
	if (!workspaceId) return;
	rankingsLoading = true;
	try {
		const res = await fetch(`/api/workspaces/${workspaceId}/exercises/${exercise.id}/rankings`);
		if (res.ok) {
			rankings = await res.json();
		}
	} catch (error) {
		console.error('Failed to load rankings:', error);
	}
	rankingsLoading = false;
}
```

Update the $effect to also load rankings:

```typescript
$effect(() => {
	if (open && exercise) {
		loadHistory();
		loadRankings();
	}
});
```

Add a helper function:

```typescript
function getRankEmoji(rank: number): string {
	if (rank === 1) return '🥇';
	if (rank === 2) return '🥈';
	if (rank === 3) return '🥉';
	return `#${rank}`;
}

// Derived to find current user's rank
let currentUserRanking = $derived.by(() => {
	if (!rankings) return null;
	return rankings.rankings.find(r => r.userId === rankings.currentUserId);
});
```

Add the rankings section in the modal content, after the History section:

```svelte
<!-- Workspace Rankings -->
{#if workspaceId}
	<div class="mt-6">
		<h3 class="mb-3 text-sm font-bold uppercase text-text-secondary">Workspace Rankings</h3>

		{#if rankingsLoading}
			<div class="h-24 animate-pulse rounded-lg bg-white/5"></div>
		{:else if rankings && rankings.rankings.length > 0}
			<div class="rounded-xl border border-white/10 bg-white/5 p-4">
				{#if currentUserRanking}
					<p class="mb-3 text-sm text-text-muted">
						You're <span class="font-bold text-white">#{currentUserRanking.rank}</span> of {rankings.totalMembers}
					</p>
				{:else}
					<p class="mb-3 text-sm text-text-muted">Log a PR to join the rankings</p>
				{/if}

				<!-- Top 3 -->
				<div class="flex flex-wrap gap-2">
					{#each rankings.rankings.slice(0, 3) as entry (entry.userId)}
						{@const isCurrentUser = entry.userId === rankings.currentUserId}
						<div class="flex items-center gap-2 rounded-lg {isCurrentUser ? 'bg-accent-500/20' : 'bg-white/5'} px-3 py-2">
							<span class="text-sm">{getRankEmoji(entry.rank)}</span>
							<span class="text-sm font-bold text-white">
								{isCurrentUser ? 'You' : entry.email.split('@')[0]}
							</span>
							<span class="text-sm text-accent-400">
								{formatPRValue(entry.value, exercise.measurementType, unitPreference)}
							</span>
						</div>
					{/each}
				</div>

				{#if rankings.rankings.length > 3}
					<p class="mt-2 text-xs text-text-muted">
						+{rankings.rankings.length - 3} more
					</p>
				{/if}
			</div>
		{:else if rankings}
			<div class="rounded-xl border border-white/10 bg-white/5 p-4">
				<p class="text-sm text-text-muted">No one has logged this exercise yet. Be the first!</p>
			</div>
		{/if}
	</div>
{/if}
```

**Step 2: Commit**

```bash
git add src/routes/(app)/prs/PRModal.svelte
git commit -m "feat(leaderboard): add workspace rankings to PR modal"
```

---

## Task 8: Final Testing and Verification

**Step 1: Run the development server**

```bash
bun run dev
```

**Step 2: Manual testing checklist**

1. Navigate to `/prs` page
2. Verify "My PRs" and "Leaderboard" tabs appear
3. Click "Leaderboard" tab
4. Verify leaderboard loads with users and points
5. Click an exercise card on leaderboard
6. Verify exercise ranking modal opens with correct data
7. Go back to "My PRs" tab
8. Click an exercise with a PR
9. Verify "Workspace Rankings" section appears in modal
10. Verify current user position is shown

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(leaderboard): address any issues found during testing"
```

---

## Summary

This implementation adds:

1. **Types** (`src/lib/types/pr.ts`) - Leaderboard and rankings interfaces
2. **Leaderboard API** (`/api/workspaces/[id]/leaderboard`) - Points calculation and exercise leaders
3. **Rankings API** (`/api/workspaces/[id]/exercises/[exerciseId]/rankings`) - Per-exercise rankings
4. **ExerciseRankingModal** - Full rankings view for an exercise
5. **LeaderboardTab** - Main leaderboard view with user rankings and exercise breakdown
6. **Updated PRs page** - Tab navigation between "My PRs" and "Leaderboard"
7. **Updated PRModal** - Workspace rankings preview section
