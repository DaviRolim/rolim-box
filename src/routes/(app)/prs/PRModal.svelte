<script lang="ts">
	import { tick } from 'svelte';
	import { formatDayMonth, todayIso } from '$lib/date';
	import {
		parseTime,
		convertWeightForStorage,
		convertDistanceForStorage,
		getWeightUnit,
		getDistanceUnit,
		isBetterPR,
		prVideoUrlSchema,
		MAX_PR_VIDEO_URL_LENGTH,
		type ExerciseWithBestPR,
		type UnitPreference,
		type ExerciseRankingsResponse
	} from '$lib/types/pr';
	import type { CachedPR } from '$lib/db/indexeddb';
	import { getUserPRs, createPR, deletePR, updatePRVideo } from '$lib/services/pr';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RankRow from './RankRow.svelte';
	import { athleteName, categoryLabel, measurementLabel, prParts } from './pr-format';
	import { t } from '$lib/i18n';

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

	let history = $state<CachedPR[]>([]);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let saveError = $state<string | null>(null);
	let showNoteField = $state(false);
	let showVideoField = $state(false);
	let invalidVideo = $state(false);
	let editingVideoId = $state<string | null>(null);
	let editedVideo = $state('');
	let savingVideo = $state(false);
	let editVideoError = $state<'invalid' | 'saveFailed' | null>(null);
	let videoEditTrigger: HTMLButtonElement | null = null;
	let deleteModalOpen = $state(false);
	let deleting = $state(false);
	let prToDelete = $state<string | null>(null);
	let rankings = $state<ExerciseRankingsResponse | null>(null);
	let rankingsLoading = $state(false);
	let rankingsFailed = $state(false);

	let inputValue = $state('');
	let inputDate = $state(todayIso());
	let inputNote = $state('');
	let inputVideo = $state('');

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
		editingVideoId = null;
		videoEditTrigger = null;
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
		inputVideo = '';
		showNoteField = false;
		showVideoField = false;
		invalidVideo = false;
		saveError = null;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		const raw = String(inputValue).trim();
		if (!raw) return;
		const video = prVideoUrlSchema.safeParse(inputVideo);
		invalidVideo = !video.success;
		saveError = null;
		if (!video.success) return;

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
				exercise.measurementType === 'time' ? t.prs.modal.timeFormatError : t.prs.modal.numberError;
			return;
		}

		isSaving = true;
		saveError = null;
		try {
			const success = await createPR({
				exerciseId: exercise.id,
				value: storageValue,
				date: inputDate,
				note: inputNote.trim() || null,
				videoUrl: video.data
			});

			if (success) {
				resetForm();
				await loadHistory();
				await loadRankings();
				onSaved();
			} else {
				saveError = t.prs.modal.saveFailed;
			}
		} catch (error) {
			console.error('Failed to save PR:', error);
			saveError = t.prs.modal.saveFailed;
		}
		isSaving = false;
	}

	async function openVideoEditor(pr: CachedPR, trigger: HTMLButtonElement) {
		if (editingVideoId === pr.id) {
			closeVideoEditor();
			return;
		}
		videoEditTrigger = trigger;
		editingVideoId = pr.id;
		editedVideo = pr.videoUrl ?? '';
		editVideoError = null;
		await tick();
		document.getElementById('pr-history-video')?.focus();
	}

	function closeVideoEditor() {
		editingVideoId = null;
		videoEditTrigger?.focus();
		videoEditTrigger = null;
	}

	async function saveVideo(pr: CachedPR, input: string) {
		const video = prVideoUrlSchema.safeParse(input);
		if (!video.success) {
			editVideoError = 'invalid';
			return;
		}

		savingVideo = true;
		editVideoError = null;
		try {
			if (await updatePRVideo(pr, video.data)) {
				history = history.map((entry) =>
					entry.id === pr.id ? { ...entry, videoUrl: video.data } : entry
				);
				savingVideo = false;
				await tick();
				closeVideoEditor();
				return;
			}
		} catch (error) {
			console.error('Failed to save PR video:', error);
		}
		editVideoError = 'saveFailed';
		savingVideo = false;
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
				return t.prs.modal.weightLabel(getWeightUnit(unitPreference));
			case 'time':
				return t.prs.modal.timeLabel;
			case 'reps':
				return t.prs.modal.repsLabel;
			case 'distance':
				return t.prs.modal.distanceLabel(getDistanceUnit(unitPreference));
		}
	});

	const bestPR = $derived.by(() => {
		if (history.length === 0) return null;
		return history.reduce(
			(best, pr) =>
				!best || isBetterPR(pr.value, best.value, exercise.measurementType) ? pr : best,
			null as CachedPR | null
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
	legend="{categoryLabel(exercise.category)} · {measurementLabel(exercise.measurementType)}"
	onclose={onClose}
>
	<!-- Log a new mark -->
	<form onsubmit={handleSubmit} novalidate>
		<div class="module-head border-t-2 border-ink">
			<span>{t.prs.modal.logNew}</span>
			{#if bestPR}
				{@const best = prParts(bestPR.value, exercise.measurementType, unitPreference)}
				<span>{t.prs.modal.best(`${best.figure}${best.unit ? ` ${best.unit}` : ''}`)}</span>
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
				<label for="pr-date" class="field-label">{t.prs.modal.date}</label>
				<input id="pr-date" type="date" bind:value={inputDate} required class="input" />
			</div>
		</div>

		{#if showNoteField}
			<div class="mt-3">
				<label for="pr-note" class="field-label">{t.prs.modal.note}</label>
				<input
					id="pr-note"
					type="text"
					placeholder={t.prs.modal.notePlaceholder}
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
				{t.prs.modal.addNote}
			</button>
		{/if}

		{#if showVideoField}
			<div class="mt-3">
				<label for="pr-video" class="field-label">{t.prs.modal.videoLink}</label>
				<input
					id="pr-video"
					type="url"
					bind:value={inputVideo}
					maxlength={MAX_PR_VIDEO_URL_LENGTH}
					aria-invalid={invalidVideo}
					aria-describedby={invalidVideo ? 'pr-video-error' : undefined}
					class="input"
				/>
				{#if invalidVideo}
					<p id="pr-video-error" class="notice notice-danger mt-3" role="alert">
						{t.prs.modal.videoUrlError}
					</p>
				{/if}
			</div>
		{:else}
			<button
				type="button"
				class="mt-1 inline-flex min-h-11 items-center gap-1.5 legend text-dim"
				onclick={() => (showVideoField = true)}
			>
				<Icon name="plus" size={14} stroke={3.4} />
				{t.prs.modal.addVideo}
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
			{isSaving ? t.common.saving : t.prs.modal.savePr}
		</button>
	</form>

	<!-- History -->
	<section class="mt-7">
		<div class="module-head border-t-2 border-ink">
			<h3>{t.prs.modal.history}</h3>
			<span>{isLoading ? '' : history.length}</span>
		</div>

		{#if isLoading}
			<div class="flex flex-col gap-2" aria-busy="true" aria-label={t.prs.modal.loadingHistory}>
				{#each [0, 1, 2] as row (row)}
					<div class="led h-14"></div>
				{/each}
			</div>
		{:else if history.length === 0}
			<p class="border-t border-line py-4 text-lg text-dim">
				{t.prs.modal.emptyHistory}
			</p>
		{:else}
			<ul>
				{#each history as pr (pr.id)}
					{@const isBest = bestPR?.id === pr.id}
					{@const parts = prParts(pr.value, exercise.measurementType, unitPreference)}
					{@const date = formatDayMonth(pr.date)}
					<li>
						<div class="entry" class:best={isBest}>
							<span class="mark" aria-hidden="true"></span>
							<span class="min-w-0 flex-1">
								<span class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
									<span class="display text-[2rem] leading-[0.9]">{parts.figure}</span>
									{#if parts.unit}<span class="legend text-dim">{parts.unit}</span>{/if}
									{#if isBest}<span class="tag tag-pink">{t.prs.modal.bestTag}</span>{/if}
								</span>
								<span class="mt-1.5 block legend text-mute">{date}</span>
								{#if pr.note}
									<span class="mt-1 block text-base leading-snug text-dim">{pr.note}</span>
								{/if}
							</span>
							{#if pr.videoUrl}
								<!-- eslint-disable svelte/no-navigation-without-resolve -- Video URLs are external. -->
								<a
									class="icon-btn"
									href={pr.videoUrl}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={t.prs.modal.watchVideoAria(date)}
								>
									<Icon name="play" size={20} solid />
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{/if}
							<button
								type="button"
								class="icon-btn"
								disabled={savingVideo}
								onclick={(event) => openVideoEditor(pr, event.currentTarget)}
								aria-expanded={editingVideoId === pr.id}
								aria-label={pr.videoUrl
									? t.prs.modal.editVideoAria(date)
									: t.prs.modal.addVideoAria(date)}
								title={pr.videoUrl ? t.prs.modal.editVideo : t.prs.modal.addVideo}
							>
								<Icon name={pr.videoUrl ? 'edit' : 'link'} size={20} stroke={2.4} />
							</button>
							<button
								type="button"
								class="icon-btn"
								disabled={savingVideo}
								onclick={() => handleDeleteClick(pr.id)}
								aria-label={t.prs.modal.deleteAria(date)}
								title={t.common.delete}
							>
								<Icon name="trash" size={20} stroke={2.4} />
							</button>
						</div>
						{#if editingVideoId === pr.id}
							<form
								class="border-t border-line pb-3"
								novalidate
								onsubmit={(event) => {
									event.preventDefault();
									void saveVideo(pr, editedVideo);
								}}
							>
								<label for="pr-history-video" class="field-label">{t.prs.modal.videoLink}</label>
								<input
									id="pr-history-video"
									type="url"
									bind:value={editedVideo}
									maxlength={MAX_PR_VIDEO_URL_LENGTH}
									aria-invalid={editVideoError === 'invalid'}
									aria-describedby={editVideoError ? 'pr-edit-video-error' : undefined}
									class="input"
								/>
								{#if editVideoError}
									<p id="pr-edit-video-error" class="notice notice-danger mt-3" role="alert">
										{editVideoError === 'invalid'
											? t.prs.modal.videoUrlError
											: t.prs.modal.videoSaveFailed}
									</p>
								{/if}
								<div class="mt-2 flex flex-wrap gap-2">
									<button type="submit" class="btn btn-sm btn-ink" disabled={savingVideo}>
										{savingVideo ? t.common.saving : t.common.save}
									</button>
									{#if pr.videoUrl}
										<button
											type="button"
											class="btn btn-sm btn-quiet"
											disabled={savingVideo}
											onclick={() => saveVideo(pr, '')}
										>
											{t.prs.modal.removeVideo}
										</button>
									{/if}
									<button
										type="button"
										class="btn btn-sm btn-quiet"
										disabled={savingVideo}
										onclick={closeVideoEditor}
									>
										{t.common.cancel}
									</button>
								</div>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- Where you stand in the box -->
	{#if workspaceId}
		<section class="mt-7">
			<div class="module-head border-t-2 border-ink">
				<h3>{t.prs.modal.inTheBox}</h3>
				{#if rankings && rankings.rankings.length > 0}
					<span>{t.prs.ranking.logged(rankings.membersWithPR, rankings.totalMembers)}</span>
				{/if}
			</div>

			{#if rankingsLoading && !rankings}
				<div class="led h-24" aria-busy="true" aria-label={t.prs.modal.loadingRanking}></div>
			{:else if rankings && rankings.rankings.length > 0}
				{@const box = rankings}
				<p class="border-t border-line py-3 text-lg leading-snug text-dim">
					{#if currentUserRanking}
						{t.prs.modal.youAre}
						<strong class="text-ink">
							{t.prs.modal.placeOf(
								String(currentUserRanking.rank).padStart(2, '0'),
								box.totalMembers
							)}
						</strong>
						{t.prs.modal.onThisOne}
					{:else}
						{t.prs.modal.logToRank}
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
						{t.prs.modal.rankedMore(box.rankings.length)}
					</p>
				{/if}
			{:else if rankings}
				<p class="border-t border-line py-4 text-lg text-dim">
					{t.prs.modal.nobodyYet}
				</p>
			{:else if rankingsFailed}
				<p class="notice notice-warn" role="status">
					{t.prs.modal.rankingOffline}
				</p>
			{/if}
		</section>
	{/if}
</Sheet>

<ConfirmDialog
	bind:open={deleteModalOpen}
	title={t.prs.modal.deleteTitle}
	legend={deleteTarget ? `${exercise.name} · ${formatDayMonth(deleteTarget.date)}` : exercise.name}
	message={t.prs.modal.deleteMessage}
	confirmLabel={deleting ? t.prs.modal.deleting : t.prs.modal.deletePr}
	cancelLabel={t.prs.modal.keepIt}
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
