<script lang="ts">
	import {
		type LeaderboardResponse,
		type ExerciseRankingsResponse,
		type UnitPreference
	} from '$lib/types/pr';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ExerciseRankingModal from './ExerciseRankingModal.svelte';
	import RankRow from './RankRow.svelte';
	import { athleteName, prParts } from './pr-format';
	import { t } from '$lib/i18n';

	/**
	 * The box leaderboard: a timing tower of athletes by points, then who holds the top mark on
	 * each exercise. Tapping an exercise opens its full ranking.
	 */
	interface Props {
		workspaceId: string;
		unitPreference: UnitPreference;
	}

	let { workspaceId, unitPreference }: Props = $props();

	let leaderboard = $state<LeaderboardResponse | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let rankingModalOpen = $state(false);
	let selectedExerciseRankings = $state<ExerciseRankingsResponse | null>(null);
	let loadingExerciseId = $state<string | null>(null);
	let rankingError = $state<string | null>(null);

	$effect(() => {
		void loadLeaderboard();
	});

	async function loadLeaderboard() {
		isLoading = true;
		error = null;
		try {
			const res = await fetch(`/api/workspaces/${workspaceId}/leaderboard`);
			if (res.ok) {
				leaderboard = await res.json();
			} else {
				error = t.prs.leaderboard.loadFailed;
			}
		} catch (e) {
			error = t.prs.leaderboard.offline;
			console.error(e);
		}
		isLoading = false;
	}

	async function openExerciseRankings(exerciseId: string) {
		loadingExerciseId = exerciseId;
		rankingError = null;
		try {
			const res = await fetch(`/api/workspaces/${workspaceId}/exercises/${exerciseId}/rankings`);
			if (res.ok) {
				selectedExerciseRankings = await res.json();
				rankingModalOpen = true;
			} else {
				rankingError = t.prs.leaderboard.rankingFailed;
			}
		} catch (e) {
			rankingError = t.prs.leaderboard.rankingOffline;
			console.error(e);
		}
		loadingExerciseId = null;
	}

	function closeRankingModal() {
		rankingModalOpen = false;
		selectedExerciseRankings = null;
	}

	// The leader's bar is full; everyone else is drawn against it.
	const maxPoints = $derived(
		leaderboard ? Math.max(...leaderboard.rankings.map((r) => r.points), 1) : 1
	);

	// Exercises somebody holds come first; the open ones wait at the bottom.
	const held = $derived(leaderboard?.exerciseLeaders.filter((e) => e.leaders.length > 0) ?? []);
	const open = $derived(leaderboard?.exerciseLeaders.filter((e) => e.leaders.length === 0) ?? []);
</script>

<ExerciseRankingModal
	bind:open={rankingModalOpen}
	data={selectedExerciseRankings}
	{unitPreference}
	onClose={closeRankingModal}
/>

{#if isLoading}
	<div class="flex flex-col gap-2" aria-busy="true" aria-label={t.prs.leaderboard.loading}>
		{#each [0, 1, 2, 3, 4, 5] as row (row)}
			<div class="led h-[4.25rem]"></div>
		{/each}
	</div>
{:else if error}
	<div class="notice notice-danger" role="alert">
		<span class="mt-0.5 flex-none text-danger-ink"
			><Icon name="alert" size={20} stroke={2.6} /></span
		>
		<div class="min-w-0 flex-1">
			<p>{error}</p>
			<button type="button" class="btn btn-sm btn-quiet mt-3" onclick={loadLeaderboard}>
				<Icon name="refresh" size={16} stroke={2.8} />
				{t.common.retry}
			</button>
		</div>
	</div>
{:else if leaderboard}
	{@const board = leaderboard}
	<div class="cols">
		<section class="min-w-0">
			<div class="module-head border-t-2 border-ink">
				<h2>{t.prs.leaderboard.boxRanking}</h2>
				<span>{t.prs.leaderboard.athletes(board.rankings.length)}</span>
			</div>

			{#if board.rankings.length === 0}
				<p class="border-t border-line py-6 text-lg text-dim">{t.prs.leaderboard.nobody}</p>
			{:else}
				<ol>
					{#each board.rankings as user (user.userId)}
						<li>
							<RankRow
								rank={user.rank}
								name={athleteName(user.email)}
								you={user.userId === board.currentUserId}
								figure={String(user.points)}
								unit={t.prs.leaderboard.points(user.points)}
								bar={user.points / maxPoints}
							/>
						</li>
					{/each}
				</ol>
				<p class="mt-3 legend leading-relaxed text-mute normal-case" style="letter-spacing: 0.02em">
					{t.prs.leaderboard.pointsNote}
				</p>
			{/if}
		</section>

		<section class="min-w-0">
			<div class="module-head border-t-2 border-ink">
				<h2>{t.prs.leaderboard.whoHoldsWhat}</h2>
				<span>{t.prs.leaderboard.taken(board.activeExercises, board.totalExercises)}</span>
			</div>

			{#if rankingError}
				<p class="notice notice-danger mb-3" role="alert">{rankingError}</p>
			{/if}

			<ul>
				{#each held as exercise (exercise.exerciseId)}
					{@const leader = exercise.leaders[0]}
					{@const mine = exercise.leaders.some((l) => l.userId === board.currentUserId)}
					{@const parts = prParts(leader.value, exercise.measurementType, unitPreference)}
					{@const busy = loadingExerciseId === exercise.exerciseId}
					<li>
						<button
							type="button"
							class="holder"
							class:mine
							disabled={busy}
							aria-busy={busy}
							onclick={() => openExerciseRankings(exercise.exerciseId)}
						>
							<span class="min-w-0 flex-1">
								<span class="ex display">{exercise.exerciseName}</span>
								<span class="mt-1.5 flex items-center gap-2 legend text-dim">
									<span class="lead-mark" class:mine aria-hidden="true">01</span>
									<span class="truncate">
										{busy
											? t.prs.modal.loadingRanking
											: leader.userId === board.currentUserId
												? t.prs.leaderboard.you
												: athleteName(leader.email)}{!busy && exercise.leaders.length > 1
											? t.prs.leaderboard.tied(exercise.leaders.length - 1)
											: ''}
									</span>
								</span>
							</span>
							<span class="fig">
								<span class="display">{parts.figure}</span>{#if parts.unit}<span
										class="legend text-dim">{parts.unit}</span
									>{/if}
							</span>
							<span class="flex-none text-mute"
								><Icon name="chevron-right" size={18} stroke={3} /></span
							>
						</button>
					</li>
				{/each}
			</ul>

			{#if open.length > 0}
				<details class="open-list">
					<summary class="legend">
						<span>{t.prs.leaderboard.stillOpen(open.length)}</span>
						<Icon name="chevron-down" size={16} stroke={3} />
					</summary>
					<ul>
						{#each open as exercise (exercise.exerciseId)}
							{@const busy = loadingExerciseId === exercise.exerciseId}
							<li>
								<button
									type="button"
									class="holder quiet"
									disabled={busy}
									aria-busy={busy}
									onclick={() => openExerciseRankings(exercise.exerciseId)}
								>
									<span class="ex min-w-0 flex-1 display">{exercise.exerciseName}</span>
									<span class="flex-none legend text-mute"
										>{busy ? t.prs.leaderboard.loadingShort : t.prs.leaderboard.noPrsYet}</span
									>
								</button>
							</li>
						{/each}
					</ul>
				</details>
			{/if}
		</section>
	</div>
{/if}

<style>
	.cols {
		display: grid;
		gap: 2.5rem;
	}
	.holder {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		min-height: 4.25rem;
		padding: 0.625rem 0.25rem 0.5rem 0;
		border-top: 1px solid var(--c-line);
		color: var(--c-ink);
		text-align: left;
	}
	.holder:disabled {
		opacity: 0.6;
	}
	.holder.quiet {
		min-height: 3.25rem;
		color: var(--c-dim);
	}
	.ex {
		display: block;
		font-size: 1.5rem;
		line-height: 0.95;
		overflow-wrap: anywhere;
	}
	.quiet .ex {
		font-size: 1.25rem;
	}
	.lead-mark {
		flex: none;
		padding: 0.1em 0.3em;
		background: var(--c-panel);
		color: var(--c-ink);
	}
	.lead-mark.mine {
		background: var(--c-pink);
		color: var(--c-on-fill);
	}
	.fig {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25rem;
		flex: none;
		white-space: nowrap;
	}
	.fig .display {
		font-size: 2rem;
		line-height: 0.9;
	}
	.open-list {
		border-top: 2px solid var(--c-ink);
		margin-top: 0.5rem;
	}
	.open-list summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 3rem;
		color: var(--c-dim);
		list-style: none;
	}
	.open-list summary::-webkit-details-marker {
		display: none;
	}
	@media (hover: hover) {
		.holder:hover:not(:disabled) {
			background: var(--c-panel);
		}
	}
	@media (min-width: 1024px) {
		.cols {
			grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
			gap: 3rem;
			align-items: start;
		}
	}
</style>
