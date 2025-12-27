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
