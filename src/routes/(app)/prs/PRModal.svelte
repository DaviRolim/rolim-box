<script lang="ts">
	import { formatDayMonth, todayIso } from '$lib/date';
	import {
		parseTime,
		convertWeightForStorage,
		convertDistanceForStorage,
		getWeightUnit,
		getDistanceUnit,
		isBetterPR,
		type ExerciseWithBestPR,
		type UnitPreference,
		type ExerciseRankingsResponse
	} from '$lib/types/pr';
	import { getUserPRs, createPR, deletePR } from '$lib/services/pr';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RankRow from './RankRow.svelte';
	import { CATEGORY_LABELS, MEASUREMENT_LABELS, athleteName, prParts } from './pr-format';

	/** One exercise: log a new mark, see your history, see where you stand in the box. */
	interface Props {
		open: boolean;
		exercise: ExerciseWithBestPR;
		unitPreference: UnitPreference;
		workspaceId?: string;
		onClose: () => void;
		onSaved: () => void;
		onDeleted: () => void;
	}

	let {
		open = $bindable(),
		exercise,
		unitPreference,
		workspaceId,
		onClose,
		onSaved,
		onDeleted
	}: Props = $props();

	// The subset of PersonalRecord fields the device cache keeps.
	type HistoryPR = {
		id: string;
		exerciseId: string;
		value: number;
		date: string;
		note: string | null;
	};
	let history = $state<HistoryPR[]>([]);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let saveError = $state<string | null>(null);
	let showNoteField = $state(false);
	let deleteModalOpen = $state(false);
	let deleting = $state(false);
	let prToDelete = $state<string | null>(null);
	let rankings = $state<ExerciseRankingsResponse | null>(null);
	let rankingsLoading = $state(false);
	let rankingsFailed = $state(false);

	let inputValue = $state('');
	let inputDate = $state(todayIso());
	let inputNote = $state('');

	// Start clean and load whenever the sheet opens on an exercise.
	let loadedFor: string | null = null;
	$effect(() => {
		if (!open) {
			loadedFor = null;
			return;
		}
		if (loadedFor === exercise.id) return;
		loadedFor = exercise.id;
		resetForm();
		rankings = null;
		void loadHistory();
		void loadRankings();
	});

	async function loadHistory() {
		isLoading = true;
		try {
			const allPRs = await getUserPRs();
			history = allPRs
				.filter((pr) => pr.exerciseId === exercise.id)
				.sort((a, b) => b.date.localeCompare(a.date));
		} catch (error) {
			console.error('Failed to load PR history:', error);
		}
		isLoading = false;
	}

	async function loadRankings() {
		if (!workspaceId) return;
		rankingsLoading = true;
		rankingsFailed = false;
		try {
			const res = await fetch(`/api/workspaces/${workspaceId}/exercises/${exercise.id}/rankings`);
			if (res.ok) rankings = await res.json();
			else rankingsFailed = true;
		} catch (error) {
			console.error('Failed to load rankings:', error);
			rankingsFailed = true;
		}
		rankingsLoading = false;
	}

	function resetForm() {
		inputValue = '';
		inputDate = todayIso();
		inputNote = '';
		showNoteField = false;
		saveError = null;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		const raw = String(inputValue).trim();
		if (!raw) return;

		let storageValue: number;
		switch (exercise.measurementType) {
			case 'weight':
				storageValue = convertWeightForStorage(parseFloat(raw), unitPreference);
				break;
			case 'distance':
				storageValue = convertDistanceForStorage(parseFloat(raw), unitPreference);
				break;
			case 'time':
				storageValue = parseTime(raw);
				break;
			case 'reps':
				storageValue = parseInt(raw);
				break;
		}

		if (!Number.isFinite(storageValue) || storageValue <= 0) {
			saveError =
				exercise.measurementType === 'time'
					? 'Write the time as minutes:seconds, for example 5:30.'
					: 'Enter a number above zero.';
			return;
		}

		isSaving = true;
		saveError = null;
		try {
			const success = await createPR({
				exerciseId: exercise.id,
				value: storageValue,
				date: inputDate,
				note: inputNote.trim() || null
			});

			if (success) {
				resetForm();
				await loadHistory();
				await loadRankings();
				onSaved();
			} else {
				saveError = 'This PR could not be saved. Try again.';
			}
		} catch (error) {
			console.error('Failed to save PR:', error);
			saveError = 'This PR could not be saved. Try again.';
		}
		isSaving = false;
	}

	function handleDeleteClick(prId: string) {
		prToDelete = prId;
		deleteModalOpen = true;
	}

	async function confirmDelete() {
		if (!prToDelete) return;
		deleting = true;
		try {
			const success = await deletePR(prToDelete);
			if (success) {
				await loadHistory();
				await loadRankings();
				onDeleted();
			}
		} catch (error) {
			console.error('Failed to delete PR:', error);
		}
		deleting = false;
		deleteModalOpen = false;
		prToDelete = null;
	}

	const inputPlaceholder = $derived.by(() => {
		switch (exercise.measurementType) {
			case 'weight':
				return '100';
			case 'time':
				return '5:30';
			case 'reps':
				return '25';
			case 'distance':
				return '5000';
		}
	});

	const inputLabel = $derived.by(() => {
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
	});

	const bestPR = $derived.by(() => {
		if (history.length === 0) return null;
		return history.reduce(
			(best, pr) =>
				!best || isBetterPR(pr.value, best.value, exercise.measurementType) ? pr : best,
			null as HistoryPR | null
		);
	});

	const currentUserRanking = $derived(
		rankings ? (rankings.rankings.find((r) => r.userId === rankings?.currentUserId) ?? null) : null
	);

	const deleteTarget = $derived(history.find((pr) => pr.id === prToDelete) ?? null);
</script>

<Sheet
	bind:open
	title={exercise.name}
	legend="{CATEGORY_LABELS[exercise.category]} · {MEASUREMENT_LABELS[exercise.measurementType]}"
	onclose={onClose}
>
	<!-- Log a new mark -->
	<form onsubmit={handleSubmit} novalidate>
		<div class="module-head border-t-2 border-ink">
			<span>Log a new PR</span>
			{#if bestPR}
				{@const best = prParts(bestPR.value, exercise.measurementType, unitPreference)}
				<span>Best {best.figure}{best.unit ? ` ${best.unit}` : ''}</span>
			{/if}
		</div>

		<div class="mt-1 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
			<div>
				<label for="pr-value" class="field-label">{inputLabel}</label>
				<input
					id="pr-value"
					type={exercise.measurementType === 'time' ? 'text' : 'number'}
					inputmode={exercise.measurementType === 'time'
						? 'text'
						: exercise.measurementType === 'reps'
							? 'numeric'
							: 'decimal'}
					step={exercise.measurementType === 'weight' || exercise.measurementType === 'distance'
						? '0.01'
						: '1'}
					min="0"
					placeholder={inputPlaceholder}
					autocomplete="off"
					bind:value={inputValue}
					required
					aria-invalid={!!saveError}
					aria-describedby={saveError ? 'pr-save-error' : undefined}
					class="input value-input"
				/>
			</div>
			<div>
				<label for="pr-date" class="field-label">Date</label>
				<input id="pr-date" type="date" bind:value={inputDate} required class="input" />
			</div>
		</div>

		{#if showNoteField}
			<div class="mt-3">
				<label for="pr-note" class="field-label">Note</label>
				<input
					id="pr-note"
					type="text"
					placeholder="Felt strong, belt on, competition day"
					bind:value={inputNote}
					maxlength="500"
					autocomplete="off"
					class="input"
				/>
			</div>
		{:else}
			<button
				type="button"
				class="mt-1 inline-flex min-h-11 items-center gap-1.5 legend text-dim"
				onclick={() => (showNoteField = true)}
			>
				<Icon name="plus" size={14} stroke={3.4} />
				Add a note
			</button>
		{/if}

		{#if saveError}
			<p id="pr-save-error" class="notice notice-danger mt-3" role="alert">{saveError}</p>
		{/if}

		<button
			type="submit"
			class="btn btn-pink btn-slab mt-3"
			disabled={isSaving || !String(inputValue).trim()}
		>
			{isSaving ? 'Saving' : 'Save PR'}
		</button>
	</form>

	<!-- History -->
	<section class="mt-7">
		<div class="module-head border-t-2 border-ink">
			<h3>History</h3>
			<span>{isLoading ? '' : history.length}</span>
		</div>

		{#if isLoading}
			<div class="flex flex-col gap-2" aria-busy="true" aria-label="Loading history">
				{#each [0, 1, 2] as row (row)}
					<div class="led h-14"></div>
				{/each}
			</div>
		{:else if history.length === 0}
			<p class="border-t border-line py-4 text-lg text-dim">
				Nothing logged yet. The first one is always a PR.
			</p>
		{:else}
			<ul>
				{#each history as pr (pr.id)}
					{@const isBest = bestPR?.id === pr.id}
					{@const parts = prParts(pr.value, exercise.measurementType, unitPreference)}
					<li class="entry" class:best={isBest}>
						<span class="mark" aria-hidden="true"></span>
						<span class="min-w-0 flex-1">
							<span class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
								<span class="display text-[2rem] leading-[0.9]">{parts.figure}</span>
								{#if parts.unit}<span class="legend text-dim">{parts.unit}</span>{/if}
								{#if isBest}<span class="tag tag-pink">Best</span>{/if}
							</span>
							<span class="mt-1.5 block legend text-mute">{formatDayMonth(pr.date)}</span>
							{#if pr.note}
								<span class="mt-1 block text-base leading-snug text-dim">{pr.note}</span>
							{/if}
						</span>
						<button
							type="button"
							class="icon-btn"
							onclick={() => handleDeleteClick(pr.id)}
							aria-label="Delete the PR of {formatDayMonth(pr.date)}"
							title="Delete"
						>
							<Icon name="trash" size={20} stroke={2.4} />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- Where you stand in the box -->
	{#if workspaceId}
		<section class="mt-7">
			<div class="module-head border-t-2 border-ink">
				<h3>In the box</h3>
				{#if rankings && rankings.rankings.length > 0}
					<span>{rankings.membersWithPR} of {rankings.totalMembers} logged</span>
				{/if}
			</div>

			{#if rankingsLoading && !rankings}
				<div class="led h-24" aria-busy="true" aria-label="Loading the ranking"></div>
			{:else if rankings && rankings.rankings.length > 0}
				{@const box = rankings}
				<p class="border-t border-line py-3 text-lg leading-snug text-dim">
					{#if currentUserRanking}
						You are
						<strong class="text-ink">
							{String(currentUserRanking.rank).padStart(2, '0')} of {box.totalMembers}
						</strong>
						on this one.
					{:else}
						Log a PR to get on this board.
					{/if}
				</p>
				<ol>
					{#each box.rankings.slice(0, 3) as entry (entry.userId)}
						{@const parts = prParts(entry.value, exercise.measurementType, unitPreference)}
						<li>
							<RankRow
								compact
								rank={entry.rank}
								name={athleteName(entry.email)}
								you={entry.userId === box.currentUserId}
								figure={parts.figure}
								unit={parts.unit}
							/>
						</li>
					{/each}
					{#if currentUserRanking && currentUserRanking.rank > 3 && !box.rankings
							.slice(0, 3)
							.some((r) => r.userId === box.currentUserId)}
						{@const parts = prParts(
							currentUserRanking.value,
							exercise.measurementType,
							unitPreference
						)}
						<li>
							<RankRow
								compact
								rank={currentUserRanking.rank}
								name={athleteName(currentUserRanking.email)}
								you
								figure={parts.figure}
								unit={parts.unit}
							/>
						</li>
					{/if}
				</ol>
				{#if box.rankings.length > 3}
					<p class="mt-3 legend text-mute">
						{box.rankings.length} ranked · the full list is on the leaderboard
					</p>
				{/if}
			{:else if rankings}
				<p class="border-t border-line py-4 text-lg text-dim">
					Nobody in the box has logged this one yet. Be the first.
				</p>
			{:else if rankingsFailed}
				<p class="notice notice-warn" role="status">
					The box ranking needs a connection and could not be loaded.
				</p>
			{/if}
		</section>
	{/if}
</Sheet>

<ConfirmDialog
	bind:open={deleteModalOpen}
	title="Delete this PR?"
	legend={deleteTarget ? `${exercise.name} · ${formatDayMonth(deleteTarget.date)}` : exercise.name}
	message="This entry is removed from your history and from the box ranking. This cannot be undone."
	confirmLabel={deleting ? 'Deleting' : 'Delete PR'}
	cancelLabel="Keep it"
	danger
	busy={deleting}
	onconfirm={confirmDelete}
	oncancel={() => (prToDelete = null)}
/>

<style>
	.value-input {
		height: 3.5rem;
		padding-block: 0.25rem;
		font-stretch: 62%;
		font-weight: 900;
		font-size: 1.75rem;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}
	.value-input::placeholder {
		font-weight: 700;
	}
	.entry {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 4.25rem;
		padding: 0.5rem 0;
		border-top: 1px solid var(--c-line);
	}
	.mark {
		align-self: stretch;
		flex: none;
		width: 0.375rem;
		background: var(--c-line);
	}
	.entry.best .mark {
		background: var(--c-pink);
	}
</style>
