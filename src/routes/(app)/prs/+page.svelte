<script lang="ts">
	import { onMount } from 'svelte';
	import { formatDayMonth } from '$lib/date';
	import { toastStore } from '$lib/stores/toast.svelte';
	import {
		type ExerciseWithBestPR,
		type ExerciseCategory,
		EXERCISE_CATEGORIES
	} from '$lib/types/pr';
	import { getExercisesWithPRs, invalidatePRCache } from '$lib/services/pr';
	import { debounce } from '$lib/utils';
	import Icon from '$lib/components/ui/Icon.svelte';
	import PRModal from './PRModal.svelte';
	import ImportPRModal from './ImportPRModal.svelte';
	import LeaderboardTab from './LeaderboardTab.svelte';
	import { categoryLabel, prParts } from './pr-format';
	import { t } from '$lib/i18n';

	let { data } = $props();

	// The person's units and box come from the app layout, so this screen needs no request of
	// its own and opens offline.
	const unitPreference = $derived(data.unitPreference);
	const activeWorkspaceId = $derived(data.activeWorkspaceId);

	let exercises = $state<ExerciseWithBestPR[]>([]);
	let loading = $state(true);
	let loadError = $state(false);

	async function load() {
		loadError = false;
		try {
			exercises = await getExercisesWithPRs();
		} catch (error) {
			console.error('Failed to load PRs:', error);
			loadError = true;
		}
		loading = false;
	}

	onMount(load);

	// Tabs
	type TabId = 'my-prs' | 'leaderboard';
	let activeTab = $state<TabId>('my-prs');
	const tabs = $derived<{ id: TabId; label: string }[]>([
		{ id: 'my-prs', label: t.prs.page.tabMine },
		{ id: 'leaderboard', label: t.prs.page.tabLeaderboard }
	]);

	function onTabKeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
		event.preventDefault();
		activeTab = activeTab === 'my-prs' ? 'leaderboard' : 'my-prs';
		document.getElementById(`tab-${activeTab}`)?.focus();
	}

	// 'recorded' is a special filter: every exercise that has a PR, whatever its category.
	type ActiveCategory = ExerciseCategory | 'recorded';

	const recorded = $derived(exercises.filter((ex) => ex.bestPR !== null));
	const defaultCategory = $derived<ActiveCategory>(
		recorded.length > 0 ? 'recorded' : 'weightlifting'
	);

	let searchQuery = $state('');
	let debouncedSearchQuery = $state('');
	const updateSearch = debounce((value: string) => {
		debouncedSearchQuery = value;
	}, 250);
	$effect(() => {
		updateSearch(searchQuery);
	});

	let activeCategory = $state<ActiveCategory | null>(null);
	const effectiveCategory = $derived<ActiveCategory>(activeCategory ?? defaultCategory);
	const isSearching = $derived(debouncedSearchQuery.trim().length > 0);

	let selectedExercise = $state<ExerciseWithBestPR | null>(null);
	let modalOpen = $state(false);
	let importModalOpen = $state(false);

	const filteredExercises = $derived.by(() => {
		if (isSearching) {
			const query = debouncedSearchQuery.trim().toLowerCase();
			return exercises.filter((ex) => ex.name.toLowerCase().includes(query));
		}
		if (effectiveCategory === 'recorded') return recorded;
		return exercises.filter((ex) => ex.category === effectiveCategory);
	});

	// One group per category when showing everything recorded, a single group otherwise.
	const groups = $derived.by(() => {
		if (isSearching)
			return [{ key: 'search', label: t.prs.page.searchResults, exercises: filteredExercises }];
		if (effectiveCategory !== 'recorded') {
			return [
				{
					key: effectiveCategory,
					label: categoryLabel(effectiveCategory),
					exercises: filteredExercises
				}
			];
		}
		return EXERCISE_CATEGORIES.map((category) => ({
			key: category as string,
			label: categoryLabel(category),
			exercises: filteredExercises.filter((ex) => ex.category === category)
		})).filter((group) => group.exercises.length > 0);
	});

	function openExercise(exercise: ExerciseWithBestPR) {
		selectedExercise = exercise;
		modalOpen = true;
	}

	function handleModalClose() {
		modalOpen = false;
		selectedExercise = null;
	}

	async function reload() {
		await invalidatePRCache();
		exercises = await getExercisesWithPRs();
		// Keep the open sheet pointing at the fresh copy of its exercise.
		if (selectedExercise) {
			const id = selectedExercise.id;
			selectedExercise = exercises.find((ex) => ex.id === id) ?? selectedExercise;
		}
	}

	async function handlePRSaved() {
		await reload();
		toastStore.success(t.prs.page.saved);
	}

	async function handlePRDeleted() {
		await reload();
		toastStore.success(t.prs.page.deleted);
	}

	async function handleImportSuccess() {
		await reload();
		toastStore.success(t.prs.page.imported);
	}
</script>

<svelte:head>
	<title>{t.common.pageTitle(t.prs.title)}</title>
</svelte:head>

{#if selectedExercise}
	<PRModal
		bind:open={modalOpen}
		exercise={selectedExercise}
		{unitPreference}
		workspaceId={activeWorkspaceId ?? undefined}
		onClose={handleModalClose}
		onSaved={handlePRSaved}
		onDeleted={handlePRDeleted}
	/>
{/if}

<ImportPRModal
	bind:open={importModalOpen}
	{unitPreference}
	onClose={() => (importModalOpen = false)}
	onImported={handleImportSuccess}
/>

<div class="page">
	<header class="flex items-end justify-between gap-4">
		<div class="min-w-0">
			<p class="legend text-mute">
				{#if loading}
					{t.prs.page.reading}
				{:else}
					{t.prs.page.logged(recorded.length, exercises.length)} · {unitPreference === 'metric'
						? 'kg'
						: 'lbs'}
				{/if}
			</p>
			<h1 class="mt-2 display text-[4.5rem] lg:text-[6rem]">{t.prs.title}</h1>
		</div>
		{#if activeTab === 'my-prs'}
			<button
				type="button"
				class="btn btn-quiet mb-1 flex-none"
				onclick={() => (importModalOpen = true)}
			>
				<Icon name="upload" size={20} stroke={2.6} />
				{t.prs.page.import}
			</button>
		{/if}
	</header>

	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="tabs" role="tablist" aria-label={t.prs.page.tabsLabel} onkeydown={onTabKeydown}>
		{#each tabs as tab (tab.id)}
			<button
				type="button"
				role="tab"
				id="tab-{tab.id}"
				aria-selected={activeTab === tab.id}
				aria-controls="panel-{tab.id}"
				tabindex={activeTab === tab.id ? 0 : -1}
				class:on={activeTab === tab.id}
				onclick={() => (activeTab = tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if activeTab === 'my-prs'}
		<div id="panel-my-prs" role="tabpanel" aria-labelledby="tab-my-prs" class="mt-5">
			{#if loading}
				<div class="flex flex-col gap-2" aria-busy="true" aria-label={t.prs.page.loadingPrs}>
					<div class="led h-14"></div>
					{#each [0, 1, 2, 3, 4, 5] as row (row)}
						<div class="led h-[4.5rem]"></div>
					{/each}
				</div>
			{:else if loadError || exercises.length === 0}
				<div class="notice notice-danger" role="alert">
					<span class="mt-0.5 flex-none text-danger-ink"
						><Icon name="alert" size={20} stroke={2.6} /></span
					>
					<div class="min-w-0 flex-1">
						<p>
							{t.prs.page.loadFailed}
						</p>
						<button
							type="button"
							class="btn btn-sm btn-quiet mt-3"
							onclick={() => {
								loading = true;
								void load();
							}}
						>
							<Icon name="refresh" size={16} stroke={2.8} />
							{t.common.retry}
						</button>
					</div>
				</div>
			{:else}
				<div class="flex flex-col gap-3 lg:flex-row lg:items-center">
					<div class="relative lg:w-96">
						<label for="pr-search" class="sr-only">{t.prs.page.searchLabel}</label>
						<span class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mute">
							<Icon name="search" size={20} stroke={2.6} />
						</span>
						<input
							id="pr-search"
							type="search"
							class="input pl-11"
							placeholder={t.prs.page.searchPlaceholder}
							autocomplete="off"
							bind:value={searchQuery}
						/>
					</div>

					<!-- Categories step aside while searching: a search looks at every exercise. -->
					{#if !isSearching}
						<div
							class="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0"
							role="group"
							aria-label={t.prs.page.categoryGroup}
						>
							<button
								type="button"
								class="tag min-h-11 flex-none px-3 {effectiveCategory === 'recorded'
									? 'tag-ink'
									: ''}"
								aria-pressed={effectiveCategory === 'recorded'}
								onclick={() => (activeCategory = 'recorded')}
							>
								{t.prs.page.recorded}
							</button>
							{#each EXERCISE_CATEGORIES as category (category)}
								<button
									type="button"
									class="tag min-h-11 flex-none px-3 {effectiveCategory === category
										? 'tag-ink'
										: ''}"
									aria-pressed={effectiveCategory === category}
									onclick={() => (activeCategory = category)}
								>
									{categoryLabel(category)}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="mt-6">
					{#if filteredExercises.length === 0}
						{#if isSearching}
							<div class="border-2 border-line-strong px-5 py-8">
								<h2 class="display text-[2.5rem]">{t.prs.page.noMatch}</h2>
								<p class="mt-2 text-lg text-dim">{t.prs.page.noMatchBody}</p>
								<button type="button" class="btn btn-quiet mt-5" onclick={() => (searchQuery = '')}>
									{t.prs.page.clearSearch}
								</button>
							</div>
						{:else if effectiveCategory === 'recorded'}
							<div class="border-2 border-line-strong gridlines px-5 py-8 lg:p-12">
								<p class="inline-block -rotate-3 sign text-[3rem] text-pink-ink" lang="pt-BR">
									Bora marcar?
								</p>
								<h2 class="mt-4 display text-[3rem] lg:text-[4rem]">{t.prs.page.noPrsYet}</h2>
								<p class="mt-3 max-w-md text-lg leading-snug text-dim">
									{t.prs.page.noPrsBody}
								</p>
								<button
									type="button"
									class="btn btn-pink mt-6"
									onclick={() => (activeCategory = 'weightlifting')}
								>
									<Icon name="plus" size={20} stroke={3.4} />
									{t.prs.page.logFirst}
								</button>
							</div>
						{:else}
							<div class="border-2 border-line-strong px-5 py-8">
								<h2 class="display text-[2.5rem]">{t.prs.page.nothingHere}</h2>
								<p class="mt-2 text-lg text-dim">{t.prs.page.emptyCategory}</p>
							</div>
						{/if}
					{:else}
						{#each groups as group (group.key)}
							<section class="group">
								<div class="module-head">
									<h2>{group.label}</h2>
									<span>{group.exercises.length}</span>
								</div>
								<ul class="tower">
									{#each group.exercises as exercise (exercise.id)}
										<li>
											<button type="button" class="row" onclick={() => openExercise(exercise)}>
												<span class="min-w-0 flex-1">
													<span class="name display">{exercise.name}</span>
													<span class="mt-1.5 block legend text-mute">
														{#if exercise.bestPR}
															{formatDayMonth(exercise.bestPR.date)}
														{:else}
															{t.prs.page.noPrYet}
														{/if}
													</span>
												</span>
												{#if exercise.bestPR}
													{@const parts = prParts(
														exercise.bestPR.value,
														exercise.measurementType,
														unitPreference
													)}
													<span class="value">
														<span class="display">{parts.figure}</span>
														{#if parts.unit}<span class="legend text-dim">{parts.unit}</span>{/if}
													</span>
												{:else}
													<span class="tag flex-none text-dim">
														<Icon name="plus" size={12} stroke={3.6} />
														{t.prs.page.log}
													</span>
												{/if}
											</button>
										</li>
									{/each}
								</ul>
							</section>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<div id="panel-leaderboard" role="tabpanel" aria-labelledby="tab-leaderboard" class="mt-5">
			{#if activeWorkspaceId}
				{#key activeWorkspaceId}
					<LeaderboardTab workspaceId={activeWorkspaceId} {unitPreference} />
				{/key}
			{:else}
				<div class="border-2 border-line-strong px-5 py-8">
					<h2 class="display text-[2.5rem]">{t.prs.page.noBox}</h2>
					<p class="mt-2 text-lg text-dim">
						{t.prs.page.noBoxBody}
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 1.5rem calc(1rem + var(--safe-right)) 0 calc(1rem + var(--safe-left));
		max-width: 76rem;
	}
	.tabs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		margin-top: 1.25rem;
		border: 2px solid var(--c-ink);
	}
	.tabs button {
		min-height: 3.25rem;
		padding-top: 0.1em;
		font-family: var(--font-sans);
		font-stretch: 62%;
		font-weight: 900;
		font-size: 1.5rem;
		line-height: 1;
		text-transform: uppercase;
		color: var(--c-dim);
	}
	.tabs button + button {
		border-left: 2px solid var(--c-ink);
	}
	.tabs button.on {
		color: var(--c-bg);
		background: var(--c-ink);
	}
	.tabs button:focus-visible {
		outline-offset: -6px;
		outline-color: var(--c-pink);
		box-shadow: none;
	}
	.group {
		border-top: 2px solid var(--c-ink);
		margin-bottom: 1.5rem;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		width: 100%;
		min-height: 4.5rem;
		padding: 0.625rem 0.25rem 0.5rem 0;
		border-top: 1px solid var(--c-line);
		color: var(--c-ink);
		text-align: left;
	}
	.name {
		display: block;
		font-size: 1.625rem;
		line-height: 0.95;
		overflow-wrap: anywhere;
	}
	.value {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25rem;
		flex: none;
		white-space: nowrap;
	}
	.value .display {
		font-size: 2.25rem;
		line-height: 0.9;
	}
	@media (hover: hover) {
		.row:hover {
			background: var(--c-panel);
		}
	}
	@media (min-width: 1024px) {
		.page {
			padding: 2.25rem 2.5rem 0;
		}
		.tabs {
			max-width: 28rem;
		}
		.tower {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			column-gap: 3rem;
		}
		.name {
			font-size: 1.875rem;
		}
		.value .display {
			font-size: 2.5rem;
		}
	}
</style>
