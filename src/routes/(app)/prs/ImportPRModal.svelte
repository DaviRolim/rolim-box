<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import type { UnitPreference, ImportedPR } from '$lib/types/pr';
	import {
		formatPRValue,
		convertWeightForDisplay,
		convertDistanceForDisplay
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

			// Initialize edited values
			editedValues = new Map(matchedPRs.map((pr) => [pr.exerciseId, pr.value]));

			if (matchedPRs.length === 0) {
				error = 'No personal records found in this image. Make sure the image clearly shows exercise names and values.';
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
			.map((pr) => ({
				exerciseId: pr.exerciseId,
				value: editedValues.get(pr.exerciseId) ?? pr.value
			}));

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
	let hasConflicts = $derived(matchedPRs.some((pr) => pr.hasConflict && selectedPRs.has(pr.exerciseId)));
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
					<h2 class="text-xl font-black text-white">Import PRs</h2>
					<p class="text-sm text-text-muted">
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
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
						<svg class="mb-4 h-12 w-12 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
						<p class="mb-1 text-white font-medium">Drop image or click to upload</p>
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
								class="absolute -right-2 -top-2 rounded-full bg-bg-surface p-1 text-text-muted hover:text-white"
							>
								<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</button>
						</div>
						<p class="text-sm text-text-muted truncate">{selectedFile.name}</p>
					</div>
				{/if}

			{:else if modalState === 'processing'}
				<!-- Processing State -->
				<div class="flex flex-col items-center justify-center py-12">
					<div class="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-accent-500 border-t-transparent"></div>
					<p class="text-text-muted">Analyzing your PRs...</p>
				</div>

			{:else if modalState === 'review'}
				<!-- Review State -->
				<div class="space-y-4">
					<!-- Summary -->
					<div class="flex items-center gap-2 text-sm">
						<span class="text-white font-medium">Found {matchedPRs.length} PRs</span>
						{#if unmatchedExercises.length > 0}
							<span class="rounded-full bg-warning/20 px-2 py-0.5 text-xs text-warning">
								{unmatchedExercises.length} skipped
							</span>
						{/if}
					</div>

					<!-- PR List -->
					<div class="space-y-2">
						{#each matchedPRs as pr (pr.exerciseId)}
							{@const isSelected = selectedPRs.has(pr.exerciseId)}
							{@const currentValue = editedValues.get(pr.exerciseId) ?? pr.value}
							<div
								class="rounded-lg border p-3 transition-colors {isSelected
									? 'border-accent-500/30 bg-accent-500/10'
									: 'border-white/10 bg-white/5 opacity-50'}"
							>
								<div class="flex items-start gap-3">
									<input
										type="checkbox"
										checked={isSelected}
										onchange={() => togglePR(pr.exerciseId)}
										class="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-accent-500 focus:ring-accent-500"
									/>
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<p class="font-medium text-white truncate">{pr.exerciseName}</p>
											{#if pr.confidence !== 'high'}
												<span class="rounded bg-warning/20 px-1.5 py-0.5 text-xs text-warning">
													{pr.confidence}
												</span>
											{/if}
										</div>
										<p class="text-xs text-text-muted truncate">{pr.originalText}</p>
										{#if pr.hasConflict && pr.existingValue}
											<p class="mt-1 text-xs text-warning">
												Existing PR: {pr.existingValue} → {currentValue}
											</p>
										{/if}
									</div>
									<input
										type="number"
										value={currentValue}
										onchange={(e) => updateValue(pr.exerciseId, Number((e.target as HTMLInputElement).value))}
										disabled={!isSelected}
										class="w-24 rounded border border-white/10 bg-white/5 px-2 py-1 text-right text-white disabled:opacity-50"
									/>
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
				<Button
					onclick={analyzeImage}
					variant="primary"
					class="w-full"
					disabled={!selectedFile}
				>
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
