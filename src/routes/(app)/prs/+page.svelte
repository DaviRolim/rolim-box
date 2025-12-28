<script lang="ts">
	import { onMount } from 'svelte';
	import Toast from '$lib/components/Toast.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import {
		formatPRValue,
		type ExerciseWithBestPR,
		type ExerciseCategory,
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

	// Load exercises on mount
	onMount(async () => {
		exercises = await getExercisesWithPRs();
		loading = false;
	});

	// Tab state
	type TabId = 'my-prs' | 'leaderboard';
	let activeTab = $state<TabId>('my-prs');

	const tabs: { id: TabId; label: string }[] = [
		{ id: 'my-prs', label: 'My PRs' },
		{ id: 'leaderboard', label: 'Leaderboard' }
	];

	// Category state - 'recorded' is a special filter showing all exercises with PRs
	type ActiveCategory = ExerciseCategory | 'recorded';

	// Check if user has any PRs to determine default category
	let hasAnyPRs = $derived(exercises.some((ex: ExerciseWithBestPR) => ex.bestPR !== null));
	let defaultCategory = $derived<ActiveCategory>(hasAnyPRs ? 'recorded' : 'weightlifting');

	// State
	let searchQuery = $state('');
	let activeCategory = $state<ActiveCategory | null>(null);

	// Use default category if none selected yet
	let effectiveCategory = $derived<ActiveCategory>(activeCategory ?? defaultCategory);
	let selectedExercise = $state<ExerciseWithBestPR | null>(null);
	let modalOpen = $state(false);
	let importModalOpen = $state(false);

	// Derived
	let filteredExercises = $derived.by(() => {
		let result = exercises;

		// Filter by search
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter((ex: ExerciseWithBestPR) => ex.name.toLowerCase().includes(query));
		} else if (effectiveCategory === 'recorded') {
			// Show only exercises with recorded PRs (from all categories)
			result = result.filter((ex: ExerciseWithBestPR) => ex.bestPR !== null);
		} else {
			// Filter by category only when not searching
			result = result.filter((ex: ExerciseWithBestPR) => ex.category === effectiveCategory);
		}

		return result;
	});

	// Group exercises by category (used when 'recorded' is active)
	let groupedExercises = $derived.by(() => {
		if (effectiveCategory !== 'recorded') return null;

		const groups: Record<ExerciseCategory, ExerciseWithBestPR[]> = {
			weightlifting: [],
			benchmark: [],
			gymnastics: [],
			cardio: []
		};

		for (const ex of filteredExercises as ExerciseWithBestPR[]) {
			groups[ex.category].push(ex);
		}

		// Return only non-empty groups in the correct order
		return EXERCISE_CATEGORIES.map((category) => ({
			category,
			exercises: groups[category]
		})).filter((group) => group.exercises.length > 0);
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

<Toast />

{#if selectedExercise}
	<PRModal
		bind:open={modalOpen}
		exercise={selectedExercise}
		unitPreference={unitPreference}
		workspaceId={activeWorkspaceId}
		onClose={handleModalClose}
		onSaved={handlePRSaved}
		onDeleted={handlePRDeleted}
	/>
{/if}

<ImportPRModal
	bind:open={importModalOpen}
	unitPreference={unitPreference}
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
				<!-- Recorded PRs tab (special filter) -->
				<button
					onclick={() => (activeCategory = 'recorded')}
					class="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold uppercase transition-all {effectiveCategory ===
					'recorded'
						? 'bg-accent-500 text-white'
						: 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'}"
				>
					Recorded
				</button>
				{#each EXERCISE_CATEGORIES as category}
					<button
						onclick={() => (activeCategory = category)}
						class="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold uppercase transition-all {effectiveCategory ===
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
		{#if effectiveCategory === 'recorded' && groupedExercises}
			<!-- Grouped view for recorded PRs -->
			{#each groupedExercises as group (group.category)}
				<div class="flex flex-col gap-3">
					<h2 class="text-sm font-bold uppercase text-text-muted">
						{categoryLabels[group.category]}
					</h2>
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
						{#each group.exercises as exercise (exercise.id)}
							<button
								onclick={() => handleExerciseClick(exercise)}
								class="group relative overflow-hidden rounded-xl border border-white/5 bg-white/5 p-4 text-left transition-all hover:border-accent-500/30 hover:bg-white/10"
							>
								<h3 class="font-bold text-white line-clamp-2">{exercise.name}</h3>
								{#if exercise.bestPR}
									<p class="mt-2 text-lg font-black text-accent-400">
										{formatPRValue(exercise.bestPR.value, exercise.measurementType, unitPreference)}
									</p>
									<p class="text-xs text-text-muted">{formatDate(exercise.bestPR.date)}</p>
								{/if}

								<!-- Hover indicator -->
								<div
									class="absolute bottom-0 left-0 h-1 w-0 bg-accent-500 transition-all group-hover:w-full"
								></div>
							</button>
						{/each}
					</div>
				</div>
			{/each}
		{:else}
			<!-- Regular grid view -->
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{#each filteredExercises as exercise (exercise.id)}
					<button
						onclick={() => handleExerciseClick(exercise)}
						class="group relative overflow-hidden rounded-xl border border-white/5 bg-white/5 p-4 text-left transition-all hover:border-accent-500/30 hover:bg-white/10"
					>
						<h3 class="font-bold text-white line-clamp-2">{exercise.name}</h3>
						{#if exercise.bestPR}
							<p class="mt-2 text-lg font-black text-accent-400">
								{formatPRValue(exercise.bestPR.value, exercise.measurementType, unitPreference)}
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
		{/if}

		<!-- Empty state -->
		{#if filteredExercises.length === 0}
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<p class="text-text-muted">
					{#if isSearching}
						No exercises found
					{:else if effectiveCategory === 'recorded'}
						No PRs recorded yet. Select a category to start tracking!
					{:else}
						No exercises in this category
					{/if}
				</p>
			</div>
		{/if}
		{/if}
	{:else if activeTab === 'leaderboard'}
		{#if activeWorkspaceId}
			<LeaderboardTab workspaceId={activeWorkspaceId} unitPreference={unitPreference} />
		{:else}
			<div class="py-12 text-center">
				<p class="text-text-muted">No workspace selected</p>
			</div>
		{/if}
	{/if}
</div>
