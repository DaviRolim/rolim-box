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
		type PersonalRecord,
		type ExerciseRankingsResponse
	} from '$lib/types/pr';

	interface Props {
		open: boolean;
		exercise: ExerciseWithBestPR;
		unitPreference: UnitPreference;
		workspaceId?: string;
		onClose: () => void;
		onSaved: () => void;
		onDeleted: () => void;
	}

	let { open = $bindable(), exercise, unitPreference, workspaceId, onClose, onSaved, onDeleted }: Props =
		$props();

	// State
	let history = $state<PersonalRecord[]>([]);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let showNoteField = $state(false);
	let deleteModalOpen = $state(false);
	let prToDelete = $state<string | null>(null);
	let rankings = $state<ExerciseRankingsResponse | null>(null);
	let rankingsLoading = $state(false);

	// Form state
	let inputValue = $state('');
	let inputDate = $state(new Date().toISOString().split('T')[0]);
	let inputNote = $state('');

	// Dialog ref
	let dialogElement: HTMLDialogElement;

	// Load history and rankings when exercise changes
	$effect(() => {
		if (open && exercise) {
			loadHistory();
			loadRankings();
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

	function resetForm() {
		inputValue = '';
		inputDate = new Date().toISOString().split('T')[0];
		inputNote = '';
		showNoteField = false;
		rankings = null;
		rankingsLoading = false;
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
		if (!String(inputValue).trim()) return;

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
				await loadRankings();
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

	function getRankEmoji(rank: number): string {
		if (rank === 1) return '🥇';
		if (rank === 2) return '🥈';
		if (rank === 3) return '🥉';
		return `#${rank}`;
	}

	let currentUserRanking = $derived.by(() => {
		if (!rankings) return null;
		const currentUserId = rankings.currentUserId;
		return rankings.rankings.find(r => r.userId === currentUserId);
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
