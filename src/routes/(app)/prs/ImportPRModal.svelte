<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import type { UnitPreference, ImportedPR, MeasurementType } from '$lib/types/pr';
	import {
		formatPRValue,
		convertValueForDisplay,
		convertValueForStorage,
		getWeightUnit,
		getDistanceUnit,
		formatTime,
		parseTime
	} from '$lib/types/pr';

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

	// State
	type ModalState = 'upload' | 'processing' | 'review';
	let modalState = $state<ModalState>('upload');
	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let error = $state<string | null>(null);

	// Analysis results
	let matchedPRs = $state<EnrichedImportedPR[]>([]);
	let unmatchedExercises = $state<string[]>([]);
	let selectedPRs = $state<Set<string>>(new Set());
	let editedValues = $state<Map<string, number>>(new Map());

	// Dialog ref
	let dialogElement: HTMLDialogElement;

	// Handle dialog open/close
	$effect(() => {
		if (!dialogElement) return;

		if (open) {
			dialogElement.showModal();
			resetModal();
		} else {
			dialogElement.close();
		}
	});

	function resetModal() {
		modalState = 'upload';
		selectedFile = null;
		previewUrl = null;
		error = null;
		matchedPRs = [];
		unmatchedExercises = [];
		selectedPRs = new Set();
		editedValues = new Map();
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

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			selectFile(file);
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		const file = e.dataTransfer?.files[0];
		if (file) {
			selectFile(file);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function selectFile(file: File) {
		// Validate type
		const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
		if (!validTypes.includes(file.type)) {
			error = 'Please upload a PNG, JPG, or WEBP image';
			return;
		}

		// Validate size (5MB)
		if (file.size > 5 * 1024 * 1024) {
			error = 'Image must be smaller than 5MB';
			return;
		}

		error = null;
		selectedFile = file;
		previewUrl = URL.createObjectURL(file);
	}

	function clearFile() {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
		selectedFile = null;
		previewUrl = null;
	}

	async function analyzeImage() {
		if (!selectedFile) return;

		modalState = 'processing';
		error = null;

		try {
			const formData = new FormData();
			formData.append('image', selectedFile);

			const res = await fetch('/api/prs/import', {
				method: 'POST',
				body: formData
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Failed to analyze image');
			}

			matchedPRs = data.matched;
			unmatchedExercises = data.unmatched;

			// Select all PRs by default
			selectedPRs = new Set(matchedPRs.map((pr) => pr.exerciseId));

			// Initialize edited values with display values (converted from storage units)
			editedValues = new Map(
				matchedPRs.map((pr) => [
					pr.exerciseId,
					convertValueForDisplay(pr.value, pr.measurementType, unitPreference)
				])
			);

			if (matchedPRs.length === 0) {
				error =
					'No personal records found in this image. Make sure the image clearly shows exercise names and values.';
				modalState = 'upload';
				return;
			}

			modalState = 'review';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to analyze image';
			modalState = 'upload';
		}
	}

	function togglePR(exerciseId: string) {
		const newSet = new Set(selectedPRs);
		if (newSet.has(exerciseId)) {
			newSet.delete(exerciseId);
		} else {
			newSet.add(exerciseId);
		}
		selectedPRs = newSet;
	}

	function updateValue(exerciseId: string, value: number) {
		const newMap = new Map(editedValues);
		newMap.set(exerciseId, value);
		editedValues = newMap;
	}

	async function importPRs() {
		const prsToImport = matchedPRs
			.filter((pr) => selectedPRs.has(pr.exerciseId))
			.map((pr) => {
				// Get the display value (from edited or original converted)
				const displayValue =
					editedValues.get(pr.exerciseId) ??
					convertValueForDisplay(pr.value, pr.measurementType, unitPreference);
				// Convert back to storage units
				return {
					exerciseId: pr.exerciseId,
					value: convertValueForStorage(displayValue, pr.measurementType, unitPreference)
				};
			});

		if (prsToImport.length === 0) return;

		modalState = 'processing';
		error = null;

		try {
			const res = await fetch('/api/prs/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prs: prsToImport })
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Failed to import PRs');
			}

			onImported();
			handleClose();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to import PRs';
			modalState = 'review';
		}
	}

	// Count selected PRs
	let selectedCount = $derived(selectedPRs.size);
	let hasConflicts = $derived(
		matchedPRs.some((pr) => pr.hasConflict && selectedPRs.has(pr.exerciseId))
	);

	// Get unit label for measurement type
	function getUnitLabel(measurementType: MeasurementType): string {
		switch (measurementType) {
			case 'weight':
				return getWeightUnit(unitPreference);
			case 'distance':
				return getDistanceUnit(unitPreference);
			case 'time':
				return 'min';
			case 'reps':
				return '';
			default:
				return '';
		}
	}
</script>

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
					<h2 class="text-2xl font-black tracking-tight text-white">Import PRs</h2>
					<p class="mt-0.5 text-sm text-text-muted">
						{#if modalState === 'upload'}
							Upload a screenshot of your PRs
						{:else if modalState === 'processing'}
							Analyzing image...
						{:else}
							Review and confirm import
						{/if}
					</p>
				</div>
				<button
					onclick={handleClose}
					aria-label="Close"
					class="rounded-lg p-2 text-text-muted hover:bg-white/10 hover:text-white"
				>
					<svg
						class="h-5 w-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-4">
			{#if error}
				<div class="mb-4 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
					{error}
				</div>
			{/if}

			{#if modalState === 'upload'}
				<!-- Upload State -->
				{#if !selectedFile}
					<label
						class="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/5 p-8 transition-colors hover:border-accent-500/50 hover:bg-white/10"
						ondrop={handleDrop}
						ondragover={handleDragOver}
					>
						<svg
							class="mb-4 h-12 w-12 text-text-muted"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path
								d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						<p class="mb-1 font-medium text-white">Drop image or click to upload</p>
						<p class="text-sm text-text-muted">PNG, JPG, or WEBP (max 5MB)</p>
						<input
							type="file"
							accept="image/png,image/jpeg,image/webp"
							onchange={handleFileSelect}
							class="hidden"
						/>
					</label>
				{:else}
					<!-- Preview -->
					<div class="rounded-xl border border-white/10 bg-white/5 p-4">
						<div class="relative mb-4">
							<img
								src={previewUrl}
								alt="Preview"
								class="max-h-64 w-full rounded-lg object-contain"
							/>
							<button
								onclick={clearFile}
								aria-label="Clear selected file"
								class="absolute -top-2 -right-2 rounded-full bg-bg-surface p-1 text-text-muted hover:text-white"
							>
								<svg
									class="h-5 w-5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</button>
						</div>
						<p class="truncate text-sm text-text-muted">{selectedFile.name}</p>
					</div>
				{/if}
			{:else if modalState === 'processing'}
				<!-- Processing State -->
				<div class="flex flex-col items-center justify-center py-12">
					<div
						class="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-accent-500 border-t-transparent"
					></div>
					<p class="text-text-muted">Analyzing your PRs...</p>
				</div>
			{:else if modalState === 'review'}
				<!-- Review State -->
				<div class="space-y-4">
					<!-- Summary -->
					<!-- Summary -->
					<div class="flex items-center justify-between px-1">
						<div class="flex items-center gap-2">
							<span class="text-lg font-bold text-white">Found {matchedPRs.length} PRs</span>
							{#if unmatchedExercises.length > 0}
								<span
									class="rounded-full border border-warning/20 bg-warning/10 px-3 py-1 text-xs font-medium text-warning"
								>
									{unmatchedExercises.length} skipped
								</span>
							{/if}
						</div>
					</div>

					<!-- PR List -->
					<div class="space-y-2">
						{#each matchedPRs as pr (pr.exerciseId)}
							{@const isSelected = selectedPRs.has(pr.exerciseId)}
							{@const currentValue = editedValues.get(pr.exerciseId) ?? pr.value}
							<div
								class="group flex items-start gap-3 rounded-xl border p-3 transition-all duration-200 md:items-center md:justify-between md:gap-4 md:p-4 {isSelected
									? 'border-accent-500 bg-accent-500/10 shadow-[0_0_15px_rgba(236,72,153,0.1)]'
									: 'bg-surface-800 hover:bg-surface-700 border-white/5 hover:border-white/10'}"
							>
								<!-- Left: Checkbox & Info -->
								<div class="flex flex-1 items-start gap-3 md:gap-4">
									<div class="relative mt-1 flex h-6 w-6 items-center justify-center md:mt-0">
										<input
											type="checkbox"
											checked={isSelected}
											onchange={() => togglePR(pr.exerciseId)}
											class="peer bg-surface-900 h-5 w-5 cursor-pointer appearance-none rounded-md border border-white/20 transition-all checked:border-accent-500 checked:bg-accent-500 focus:ring-0 focus:ring-offset-0"
										/>
										<svg
											class="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="3"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<polyline points="20 6 9 17 4 12" />
										</svg>
									</div>

									<div class="min-w-0 flex-1">
										<div class="flex flex-wrap items-center gap-2">
											<p class="truncate text-base font-bold text-white md:text-lg">
												{pr.exerciseName}
											</p>
											{#if pr.confidence !== 'high'}
												<span
													class="rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase {pr.confidence ===
													'medium'
														? 'bg-warning/20 text-warning'
														: 'bg-error/20 text-error'}"
												>
													{pr.confidence}
												</span>
											{/if}
										</div>
										<p class="mt-0.5 truncate text-xs text-text-muted">{pr.originalText}</p>
										{#if pr.hasConflict && pr.existingValue}
											{@const existingDisplayValue = convertValueForDisplay(
												pr.existingValue,
												pr.measurementType,
												unitPreference
											)}
											{@const unit = getUnitLabel(pr.measurementType)}
											<div
												class="mt-2 flex w-fit items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-2 py-1 text-xs text-warning"
											>
												<svg
													class="h-3 w-3"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
												>
													<path
														d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
														stroke-linecap="round"
														stroke-linejoin="round"
													/>
												</svg>
												<span>Update: {existingDisplayValue}{unit} → {currentValue}{unit}</span>
											</div>
										{/if}
									</div>
								</div>

								<!-- Right: Value Input -->
								<div class="flex flex-shrink-0 items-center gap-2">
									<div class="flex items-center gap-1.5 md:gap-2">
										{#if pr.measurementType === 'time'}
											<input
												type="text"
												value={formatTime(currentValue)}
												onchange={(e) =>
													updateValue(
														pr.exerciseId,
														parseTime((e.target as HTMLInputElement).value)
													)}
												disabled={!isSelected}
												class="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-right text-base font-bold text-white transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500 focus:outline-none disabled:opacity-50 md:w-28 md:px-3 md:py-2 md:text-lg"
											/>
										{:else}
											<input
												type="number"
												step="any"
												value={currentValue}
												onchange={(e) =>
													updateValue(pr.exerciseId, Number((e.target as HTMLInputElement).value))}
												disabled={!isSelected}
												class="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-right text-base font-bold text-white transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500 focus:outline-none disabled:opacity-50 md:w-24 md:px-3 md:py-2 md:text-lg"
											/>
										{/if}
										{#if getUnitLabel(pr.measurementType)}
											<span
												class="w-6 flex-shrink-0 text-[10px] font-medium text-text-muted md:text-xs"
											>
												{getUnitLabel(pr.measurementType)}
											</span>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Unmatched exercises -->
					{#if unmatchedExercises.length > 0}
						<details class="rounded-lg border border-white/10 bg-white/5">
							<summary class="cursor-pointer p-3 text-sm text-text-muted hover:text-white">
								{unmatchedExercises.length} exercises couldn't be matched
							</summary>
							<div class="border-t border-white/10 p-3">
								<ul class="space-y-1 text-sm text-text-muted">
									{#each unmatchedExercises as name}
										<li>• {name}</li>
									{/each}
								</ul>
							</div>
						</details>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="border-t border-white/10 p-4">
			{#if modalState === 'upload'}
				<Button onclick={analyzeImage} variant="primary" class="w-full" disabled={!selectedFile}>
					Analyze Image
				</Button>
			{:else if modalState === 'review'}
				<div class="flex gap-3">
					<Button onclick={() => (modalState = 'upload')} variant="secondary" class="flex-1">
						Back
					</Button>
					<Button
						onclick={importPRs}
						variant="primary"
						class="flex-1"
						disabled={selectedCount === 0}
					>
						Import {selectedCount} PR{selectedCount !== 1 ? 's' : ''}
					</Button>
				</div>
			{/if}
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
