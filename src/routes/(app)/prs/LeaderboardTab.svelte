<script lang="ts">
	import {
		formatPRValue,
		type LeaderboardResponse,
		type ExerciseRankingsResponse,
		type UnitPreference
	} from '$lib/types/pr';
	import ExerciseRankingModal from './ExerciseRankingModal.svelte';

	interface Props {
		workspaceId: string;
		unitPreference: UnitPreference;
	}

	let { workspaceId, unitPreference }: Props = $props();

	let leaderboard = $state<LeaderboardResponse | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// Modal state
	let rankingModalOpen = $state(false);
	let selectedExerciseRankings = $state<ExerciseRankingsResponse | null>(null);
	let loadingExerciseId = $state<string | null>(null);

	$effect(() => {
		loadLeaderboard();
	});

	async function loadLeaderboard() {
		isLoading = true;
		error = null;
		try {
			const res = await fetch(`/api/workspaces/${workspaceId}/leaderboard`);
			if (res.ok) {
				leaderboard = await res.json();
			} else {
				error = 'Failed to load leaderboard';
			}
		} catch (e) {
			error = 'Failed to load leaderboard';
			console.error(e);
		}
		isLoading = false;
	}

	async function openExerciseRankings(exerciseId: string) {
		loadingExerciseId = exerciseId;
		try {
			const res = await fetch(`/api/workspaces/${workspaceId}/exercises/${exerciseId}/rankings`);
			if (res.ok) {
				selectedExerciseRankings = await res.json();
				rankingModalOpen = true;
			}
		} catch (e) {
			console.error(e);
		}
		loadingExerciseId = null;
	}

	function closeRankingModal() {
		rankingModalOpen = false;
		selectedExerciseRankings = null;
	}

	function getRankDisplay(rank: number): string {
		if (rank === 1) return '🥇';
		if (rank === 2) return '🥈';
		if (rank === 3) return '🥉';
		return `#${rank}`;
	}

	// Calculate max points for progress bar scaling
	let maxPoints = $derived(
		leaderboard ? Math.max(...leaderboard.rankings.map((r) => r.points), 1) : 1
	);
</script>

<ExerciseRankingModal
	bind:open={rankingModalOpen}
	data={selectedExerciseRankings}
	{unitPreference}
	onClose={closeRankingModal}
/>

{#if isLoading}
	<div class="space-y-4">
		<div class="h-8 w-48 animate-pulse rounded bg-white/5"></div>
		{#each Array(5) as _}
			<div class="h-16 animate-pulse rounded-lg bg-white/5"></div>
		{/each}
	</div>
{:else if error}
	<div class="py-12 text-center">
		<p class="text-text-muted">{error}</p>
		<button onclick={loadLeaderboard} class="mt-4 text-accent-400 hover:underline">
			Try again
		</button>
	</div>
{:else if leaderboard}
	<div class="space-y-6">
		<!-- Rankings Section -->
		<section>
			<h2 class="mb-4 flex items-center gap-2 text-lg font-black text-white">
				<span>🏆</span> Workspace Leaderboard
			</h2>

			{#if leaderboard.rankings.length === 0}
				<p class="py-8 text-center text-text-muted">No members in this workspace yet</p>
			{:else}
				<div class="space-y-2">
					{#each leaderboard.rankings as user (user.userId)}
						{@const isCurrentUser = user.userId === leaderboard.currentUserId}
						<div
							class="flex items-center gap-4 rounded-lg border p-3 {isCurrentUser
								? 'border-accent-500/30 bg-accent-500/10'
								: 'border-white/5 bg-white/5'}"
						>
							<span class="w-10 text-center text-lg font-bold {user.rank <= 3 ? '' : 'text-text-muted'}">
								{getRankDisplay(user.rank)}
							</span>
							<div class="flex-1">
								<p class="font-bold text-white">
									{isCurrentUser ? 'You' : user.email.split('@')[0]}
								</p>
								<div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
									<div
										class="h-full rounded-full bg-gradient-to-r from-accent-500 to-primary-500 transition-all"
										style="width: {(user.points / maxPoints) * 100}%"
									></div>
								</div>
							</div>
							<span class="text-lg font-black text-accent-400">
								{user.points} pt{user.points !== 1 ? 's' : ''}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Exercise Breakdown Section -->
		<section>
			<h2 class="mb-4 text-lg font-black text-white">Exercise Breakdown</h2>
			<p class="mb-4 text-sm text-text-muted">
				{leaderboard.activeExercises} of {leaderboard.totalExercises} exercises have PRs logged
			</p>

			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{#each leaderboard.exerciseLeaders as exercise (exercise.exerciseId)}
					{@const hasLeaders = exercise.leaders.length > 0}
					{@const isLoading = loadingExerciseId === exercise.exerciseId}
					<button
						onclick={() => openExerciseRankings(exercise.exerciseId)}
						disabled={isLoading}
						class="group relative overflow-hidden rounded-xl border p-4 text-left transition-all {hasLeaders
							? 'border-white/5 bg-white/5 hover:border-accent-500/30 hover:bg-white/10'
							: 'border-white/5 bg-white/[0.02] hover:bg-white/5'}"
					>
						<h3 class="font-bold text-white line-clamp-2">{exercise.exerciseName}</h3>

						{#if hasLeaders}
							{@const leader = exercise.leaders[0]}
							{@const isCurrentUserLeader = leader.userId === leaderboard.currentUserId}
							<p class="mt-2 text-sm text-accent-400">
								🥇 {isCurrentUserLeader ? 'You' : leader.email.split('@')[0]}
							</p>
							<p class="text-lg font-black text-white">
								{formatPRValue(leader.value, exercise.measurementType, unitPreference)}
							</p>
							{#if exercise.leaders.length > 1}
								<p class="text-xs text-text-muted">+{exercise.leaders.length - 1} tied</p>
							{/if}
						{:else}
							<p class="mt-2 text-sm text-text-muted">No PRs yet</p>
							<p class="text-xs text-text-muted">Be the first!</p>
						{/if}

						{#if isLoading}
							<div class="absolute inset-0 flex items-center justify-center bg-black/50">
								<div class="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent"></div>
							</div>
						{/if}

						<div
							class="absolute bottom-0 left-0 h-1 w-0 bg-accent-500 transition-all group-hover:w-full"
						></div>
					</button>
				{/each}
			</div>
		</section>
	</div>
{/if}
