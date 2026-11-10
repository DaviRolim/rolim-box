<script lang="ts">
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { UnitPreference, ImportedPR, MeasurementType } from '$lib/types/pr';
	import {
		convertValueForDisplay,
		convertValueForStorage,
		getWeightUnit,
		getDistanceUnit,
		formatTime,
		parseTime
	} from '$lib/types/pr';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n';

	/**
	 * Import PRs from a screenshot of another app: upload the picture, let the server read it,
	 * then check every line (and fix it) before anything is saved.
	 */
	interface EnrichedImportedPR extends ImportedPR {
		hasConflict: boolean;
		existingValue: number | null;
	}

	interface Props {
		open: boolean;
		unitPreference: UnitPreference;
		onClose: () => void;
		onImported: () => void;
	}

	let { open = $bindable(), unitPreference, onClose, onImported }: Props = $props();

	type ModalState = 'upload' | 'processing' | 'review';
	let modalState = $state<ModalState>('upload');
	let processingWhat = $state<'reading' | 'saving'>('reading');
	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let error = $state<string | null>(null);
	let dragging = $state(false);

	// Analysis results
	let matchedPRs = $state<EnrichedImportedPR[]>([]);
	let unmatchedExercises = $state<string[]>([]);
	const selectedPRs = new SvelteSet<string>();
	/** Values as the person sees and edits them (display units), by exercise id. */
	const editedValues = new SvelteMap<string, number>();

	// A fresh start every time the sheet opens.
	let wasOpen = false;
	$effect(() => {
		if (open && !wasOpen) resetModal();
		wasOpen = open;
	});

	function resetModal() {
		modalState = 'upload';
		clearFile();
		error = null;
		matchedPRs = [];
		unmatchedExercises = [];
		selectedPRs.clear();
		editedValues.clear();
	}

	function handleClose() {
		open = false;
		onClose();
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) selectFile(file);
		input.value = '';
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		const file = event.dataTransfer?.files[0];
		if (file) selectFile(file);
	}

	function selectFile(file: File) {
		const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
		if (!validTypes.includes(file.type)) {
			error = t.prs.import.wrongType;
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			error = t.prs.import.tooBig;
			return;
		}

		error = null;
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		selectedFile = file;
		previewUrl = URL.createObjectURL(file);
	}

	function clearFile() {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		selectedFile = null;
		previewUrl = null;
	}

	async function analyzeImage() {
		if (!selectedFile) return;

		modalState = 'processing';
		processingWhat = 'reading';
		error = null;

		try {
			const formData = new FormData();
			formData.append('image', selectedFile);

			const res = await fetch('/api/prs/import', { method: 'POST', body: formData });
			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || t.prs.import.analyzeFailed);
			}

			matchedPRs = data.matched;
			unmatchedExercises = data.unmatched;

			// Everything is selected to begin with.
			selectedPRs.clear();
			editedValues.clear();
			for (const pr of matchedPRs) {
				selectedPRs.add(pr.exerciseId);
				editedValues.set(
					pr.exerciseId,
					convertValueForDisplay(pr.value, pr.measurementType, unitPreference)
				);
			}

			if (matchedPRs.length === 0) {
				error = t.prs.import.nothingFound;
				modalState = 'upload';
				return;
			}

			modalState = 'review';
		} catch (err) {
			// A network failure has no message worth showing; the server's own message is localised.
			error =
				err instanceof Error && !(err instanceof TypeError)
					? err.message
					: t.prs.import.analyzeFailed;
			modalState = 'upload';
		}
	}

	function togglePR(exerciseId: string) {
		if (selectedPRs.has(exerciseId)) selectedPRs.delete(exerciseId);
		else selectedPRs.add(exerciseId);
	}

	function updateValue(exerciseId: string, value: number) {
		if (Number.isFinite(value)) editedValues.set(exerciseId, value);
	}

	function displayValue(pr: EnrichedImportedPR): number {
		return (
			editedValues.get(pr.exerciseId) ??
			convertValueForDisplay(pr.value, pr.measurementType, unitPreference)
		);
	}

	async function importPRs() {
		const prsToImport = matchedPRs
			.filter((pr) => selectedPRs.has(pr.exerciseId))
			.map((pr) => ({
				exerciseId: pr.exerciseId,
				// Back to storage units (grams, seconds, centimetres).
				value: convertValueForStorage(displayValue(pr), pr.measurementType, unitPreference)
			}));

		if (prsToImport.length === 0) return;

		modalState = 'processing';
		processingWhat = 'saving';
		error = null;

		try {
			const res = await fetch('/api/prs/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prs: prsToImport })
			});
			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || t.prs.import.importFailed);
			}

			onImported();
			handleClose();
		} catch (err) {
			error =
				err instanceof Error && !(err instanceof TypeError)
					? err.message
					: t.prs.import.importFailed;
			modalState = 'review';
		}
	}

	const selectedCount = $derived(selectedPRs.size);
	const conflictCount = $derived(
		matchedPRs.filter((pr) => pr.hasConflict && selectedPRs.has(pr.exerciseId)).length
	);

	function getUnitLabel(measurementType: MeasurementType): string {
		switch (measurementType) {
			case 'weight':
				return getWeightUnit(unitPreference);
			case 'distance':
				return getDistanceUnit(unitPreference);
			case 'time':
				return 'm:ss';
			default:
				return '';
		}
	}

	function show(value: number, measurementType: MeasurementType): string {
		return measurementType === 'time' ? formatTime(value) : String(value);
	}

	const legend = $derived(
		modalState === 'upload'
			? t.prs.import.stepUpload
			: modalState === 'processing'
				? processingWhat === 'reading'
					? t.prs.import.readingImage
					: t.prs.import.saving
				: t.prs.import.stepReview
	);
</script>

<Sheet bind:open title={t.prs.import.title} {legend} wide onclose={onClose}>
	{#if error}
		<div class="notice notice-danger mb-4" role="alert">
			<span class="mt-0.5 flex-none text-danger-ink"
				><Icon name="alert" size={20} stroke={2.6} /></span
			>
			<p>{error}</p>
		</div>
	{/if}

	{#if modalState === 'upload'}
		{#if !selectedFile}
			<label
				class="drop gridlines"
				class:dragging
				ondrop={handleDrop}
				ondragover={(event) => {
					event.preventDefault();
					dragging = true;
				}}
				ondragleave={() => (dragging = false)}
			>
				<Icon name="upload" size={36} stroke={2.2} />
				<span class="mt-3 display text-[2rem]">{t.prs.import.pick}</span>
				<span class="mt-2 max-w-xs text-base leading-snug text-dim">
					{t.prs.import.pickBody}
				</span>
				<span class="mt-3 legend text-mute">{t.prs.import.fileRules}</span>
				<input
					type="file"
					accept="image/png,image/jpeg,image/webp"
					onchange={handleFileSelect}
					class="sr-only"
				/>
			</label>
		{:else}
			<div class="border-2 border-line-strong">
				<img src={previewUrl} alt={t.prs.import.previewAlt} class="preview" />
				<div class="flex items-center gap-3 border-t-2 border-line-strong p-2 pl-3">
					<p class="min-w-0 flex-1 truncate legend text-dim normal-case">{selectedFile.name}</p>
					<button type="button" class="btn btn-sm btn-quiet flex-none" onclick={clearFile}>
						<Icon name="x" size={16} stroke={3} />
						{t.prs.import.remove}
					</button>
				</div>
			</div>
		{/if}
	{:else if modalState === 'processing'}
		<div class="py-10" role="status" aria-live="polite">
			<p class="display text-[2.5rem]">
				{processingWhat === 'reading' ? t.prs.import.readingTitle : t.prs.import.savingTitle}
			</p>
			<p class="mt-2 text-lg text-dim">
				{processingWhat === 'reading' ? t.prs.import.readingBody : t.prs.import.almostThere}
			</p>
			<div class="led mt-5 h-3"></div>
		</div>
	{:else}
		<div class="module-head border-t-2 border-ink">
			<span>{t.prs.import.found(matchedPRs.length)}</span>
			<span>
				{t.prs.import.selected(selectedCount)}{unmatchedExercises.length > 0
					? ` · ${t.prs.import.skipped(unmatchedExercises.length)}`
					: ''}
			</span>
		</div>

		{#if conflictCount > 0}
			<p class="notice notice-warn mb-3" role="status">
				{t.prs.import.conflicts(conflictCount)}
			</p>
		{/if}

		<ul>
			{#each matchedPRs as pr (pr.exerciseId)}
				{@const isSelected = selectedPRs.has(pr.exerciseId)}
				{@const currentValue = displayValue(pr)}
				{@const unit = getUnitLabel(pr.measurementType)}
				<li class="line" class:off={!isSelected}>
					<label class="pick">
						<input
							type="checkbox"
							class="sr-only"
							checked={isSelected}
							onchange={() => togglePR(pr.exerciseId)}
						/>
						<span class="box" aria-hidden="true">
							{#if isSelected}<Icon name="check" size={18} stroke={3.6} />{/if}
						</span>
						<span class="min-w-0 flex-1">
							<span class="flex flex-wrap items-center gap-x-2 gap-y-1">
								<span class="display text-[1.5rem] leading-[0.95]">{pr.exerciseName}</span>
								{#if pr.confidence !== 'high'}
									<span class="tag {pr.confidence === 'medium' ? 'tag-warn' : 'tag-ink'}">
										{pr.confidence === 'medium' ? t.prs.import.checkThis : t.prs.import.unsure}
									</span>
								{/if}
							</span>
							<span
								class="mt-1.5 block truncate legend text-mute normal-case"
								style="letter-spacing: 0.02em"
							>
								{t.prs.import.readAs(pr.originalText)}
							</span>
							{#if pr.hasConflict && pr.existingValue}
								{@const existing = convertValueForDisplay(
									pr.existingValue,
									pr.measurementType,
									unitPreference
								)}
								<span class="mt-1.5 flex items-center gap-1.5 legend text-warn-ink">
									<Icon name="alert" size={14} stroke={2.8} />
									{t.prs.import.replaces}
									{show(existing, pr.measurementType)} → {show(
										currentValue,
										pr.measurementType
									)}{pr.measurementType === 'time' ? '' : ` ${unit}`}
								</span>
							{/if}
						</span>
					</label>

					<div class="amount">
						<label for="import-{pr.exerciseId}" class="sr-only">
							{t.prs.import.valueFor(pr.exerciseName)}{unit ? ` (${unit})` : ''}
						</label>
						{#if pr.measurementType === 'time'}
							<input
								id="import-{pr.exerciseId}"
								type="text"
								inputmode="text"
								class="input num"
								value={formatTime(currentValue)}
								onchange={(event) =>
									updateValue(pr.exerciseId, parseTime(event.currentTarget.value))}
								disabled={!isSelected}
							/>
						{:else}
							<input
								id="import-{pr.exerciseId}"
								type="number"
								inputmode="decimal"
								step="any"
								class="input num"
								value={currentValue}
								onchange={(event) => updateValue(pr.exerciseId, Number(event.currentTarget.value))}
								disabled={!isSelected}
							/>
						{/if}
						<span class="w-8 flex-none legend text-mute normal-case">{unit}</span>
					</div>
				</li>
			{/each}
		</ul>

		{#if unmatchedExercises.length > 0}
			<details class="skipped">
				<summary class="legend">
					<span>
						{t.prs.import.unmatched(unmatchedExercises.length)}
					</span>
					<Icon name="chevron-down" size={16} stroke={3} />
				</summary>
				<ul class="pb-3">
					{#each unmatchedExercises as name, index (index)}
						<li class="border-t border-line py-2 text-base text-dim">{name}</li>
					{/each}
				</ul>
			</details>
		{/if}
	{/if}

	{#snippet actions()}
		{#if modalState === 'upload'}
			<button type="button" class="btn btn-pink" onclick={analyzeImage} disabled={!selectedFile}>
				{t.prs.import.readImage}
			</button>
			<button type="button" class="btn btn-quiet" onclick={handleClose}>{t.common.cancel}</button>
		{:else if modalState === 'review'}
			<button type="button" class="btn btn-pink" onclick={importPRs} disabled={selectedCount === 0}>
				{t.prs.import.importN(selectedCount)}
			</button>
			<button type="button" class="btn btn-quiet" onclick={() => (modalState = 'upload')}>
				{t.common.back}
			</button>
		{:else}
			<button type="button" class="btn btn-quiet" disabled>{t.prs.import.working}</button>
		{/if}
	{/snippet}
</Sheet>

<style>
	.drop {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 1.5rem 1.25rem;
		border: 2px dashed var(--c-line-strong);
		color: var(--c-ink);
		cursor: pointer;
	}
	.drop.dragging,
	.drop:focus-within {
		border-style: solid;
		border-color: var(--c-ink);
	}
	@media (hover: hover) {
		.drop:hover {
			border-color: var(--c-ink);
		}
	}
	.preview {
		display: block;
		width: 100%;
		max-height: 18rem;
		object-fit: contain;
		background: var(--c-panel);
	}
	.line {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem 0;
		border-top: 1px solid var(--c-line);
	}
	.pick {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		min-width: 0;
		flex: 1;
		min-height: 2.75rem;
		cursor: pointer;
	}
	.box {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 2rem;
		height: 2rem;
		border: 2px solid var(--c-ink);
		border-radius: 2px;
		color: var(--c-on-fill);
	}
	.pick input:checked + .box {
		background: var(--c-pink);
		border-color: var(--c-pink);
	}
	.pick input:focus-visible + .box {
		outline: 3px solid var(--c-ink);
		outline-offset: 2px;
	}
	.off .pick {
		color: var(--c-mute);
	}
	.amount {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-left: 2.75rem;
	}
	.amount .input {
		width: 8rem;
		min-height: 3rem;
		padding-block: 0.5rem;
		font-stretch: 62%;
		font-weight: 900;
		font-size: 1.5rem;
		line-height: 1.1;
		text-align: right;
	}
	.skipped {
		border-top: 2px solid var(--c-ink);
	}
	.skipped summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 3rem;
		color: var(--c-dim);
		list-style: none;
	}
	.skipped summary::-webkit-details-marker {
		display: none;
	}
	@media (min-width: 640px) {
		.line {
			flex-direction: row;
			align-items: center;
			gap: 1rem;
		}
		.amount {
			flex: none;
			padding-left: 0;
		}
	}
</style>
