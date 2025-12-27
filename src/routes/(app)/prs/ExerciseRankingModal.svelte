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
