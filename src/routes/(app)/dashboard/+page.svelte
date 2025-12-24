<script lang="ts">
	import { onMount } from 'svelte';
	import { listWoDs } from '$lib/services/wod';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { WoD } from '$lib/types/wod';

	let { data } = $props();

	let wods = $state<WoD[]>([]);
	let loading = $state(true);
	let todaysWoD = $state<WoD | null>(null);
	let recentWoDs = $state<WoD[]>([]);

	const today = new Date().toISOString().split('T')[0];

	onMount(async () => {
		if (!data.workspaceId) {
			loading = false;
			return;
		}

		try {
			wods = await listWoDs(data.workspaceId);

			// Find today's workout
			todaysWoD = wods.find((wod) => wod.date === today) || null;

			// Get recent workouts (last 3, excluding today's)
			recentWoDs = wods.filter((wod) => wod.date !== today).slice(0, 3);
		} catch (error) {
			console.error('Failed to load workouts:', error);
		} finally {
			loading = false;
		}
	});

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatDayOfWeek(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', { weekday: 'long' });
	}

	function getPreviewText(wod: WoD): string {
		if (wod.description) {
			return wod.description.slice(0, 100) + (wod.description.length > 100 ? '...' : '');
		}
		// Fallback to first section content
		if (wod.sections.length > 0) {
			const content = wod.sections[0].content;
			return content.slice(0, 100) + (content.length > 100 ? '...' : '');
		}
		return 'No description';
	}
</script>

<svelte:head>
	<title>Dashboard - RolimBox</title>
</svelte:head>

<div class="flex flex-col gap-8 p-4 pb-24 md:p-6">
	<!-- Dashboard Header -->
	<header class="flex items-end justify-between border-b border-white/10 pb-4">
		<div>
			<h1
				class="bg-gradient-to-r from-white to-white/50 bg-clip-text text-3xl font-black tracking-tight text-transparent uppercase"
			>
				Dashboard
			</h1>
			<div class="h-1 w-16 bg-gradient-to-r from-accent-500 to-primary-500"></div>
		</div>
		<div
			class="glass flex flex-col items-end rounded-lg border border-white/5 bg-white/5 px-4 py-2"
		>
			<span class="text-xs font-bold tracking-widest text-accent-400 uppercase"
				>{formatDayOfWeek(today)}</span
			>
			<span class="text-sm font-medium text-text-primary">{formatDate(today)}</span>
		</div>
	</header>

	<!-- Today's Workout Section -->
	<section class="flex flex-col gap-4">
		<div class="flex items-center gap-3">
			<h2 class="text-lg font-bold tracking-wide text-text-primary uppercase">Today's Workout</h2>
			<div class="h-[2px] flex-1 bg-white/5"></div>
		</div>

		{#if loading}
			<Card class="space-y-4">
				<Skeleton variant="text" height="1.5rem" width="60%" />
				<Skeleton variant="text" height="1rem" width="100%" />
				<Skeleton variant="text" height="1rem" width="80%" />
				<div class="flex gap-3 pt-2">
					<Skeleton variant="button" width="100px" height="44px" />
					<Skeleton variant="button" width="100px" height="44px" />
				</div>
			</Card>
		{:else if todaysWoD}
			<Card class="relative overflow-hidden border-l-4 border-l-accent-500">
				<!-- Background Glow -->
				<div
					class="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-accent-500/10 blur-3xl"
				></div>

				<div class="relative z-10 flex flex-col gap-4">
					<div class="flex items-center justify-between">
						<div
							class="rounded-md bg-accent-500/10 px-2 py-1 text-xs font-bold tracking-wider text-accent-400 uppercase"
						>
							{formatDate(todaysWoD.date)}
						</div>
						{#if todaysWoD.sections.length > 0}
							<span class="text-xs text-text-muted">{todaysWoD.sections.length} sections</span>
						{/if}
					</div>

					<p class="text-base leading-relaxed text-text-secondary">{getPreviewText(todaysWoD)}</p>

					<div class="flex gap-3 pt-2">
						<a href="/workouts/{todaysWoD.id}" class="w-full sm:w-auto">
							<Button variant="primary" class="w-full sm:w-auto">VIEW WOD</Button>
						</a>
						<a href="/workouts/{todaysWoD.id}/edit" class="w-full sm:w-auto">
							<Button variant="secondary" class="w-full sm:w-auto">EDIT</Button>
						</a>
					</div>
				</div>
			</Card>
		{:else}
			<Card
				class="flex flex-col items-center justify-center gap-4 border-dashed border-white/10 bg-transparent py-8 text-center"
			>
				<div
					class="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-text-muted"
				>
					<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path
							d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</div>
				<div class="space-y-1">
					<p class="font-medium text-text-primary">No workout scheduled</p>
					<p class="text-sm text-text-muted">Take a rest day or create a new one.</p>
				</div>
				<a href="/workouts/new">
					<Button variant="outline" size="sm">Create Today's WOD</Button>
				</a>
			</Card>
		{/if}
	</section>

	<!-- Quick Actions -->
	<div class="grid grid-cols-2 gap-4">
		<a
			href="/workouts/new"
			class="group to-accent-800 relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-600 p-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-accent-600/20"
		>
			<div
				class="relative flex h-full flex-col items-center justify-center gap-3 rounded-xl bg-bg-card/40 p-6 text-center backdrop-blur-sm transition-colors group-hover:bg-transparent"
			>
				<div
					class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-transform group-hover:scale-110"
				>
					<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path
							d="M12 5v14M5 12h14"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</div>
				<span class="font-bold tracking-wider text-white uppercase">New WOD</span>
			</div>
		</a>

		<a
			href="/workouts"
			class="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 p-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary-600/20"
		>
			<div
				class="relative flex h-full flex-col items-center justify-center gap-3 rounded-xl bg-bg-card/40 p-6 text-center backdrop-blur-sm transition-colors group-hover:bg-transparent"
			>
				<div
					class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-transform group-hover:scale-110"
				>
					<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path
							d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path
							d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</div>
				<span class="font-bold tracking-wider text-white uppercase">Library</span>
			</div>
		</a>
	</div>

	<!-- Quick Timers -->
	<section class="flex flex-col gap-4">
		<div class="flex items-center gap-3">
			<h2 class="text-lg font-bold tracking-wide text-text-primary uppercase">Quick Timers</h2>
			<div class="h-[2px] flex-1 bg-white/5"></div>
		</div>

		<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
			<a href="/timers?type=amrap">
				<Card
					class="flex flex-col gap-1 p-4 transition-transform hover:-translate-y-1 hover:border-accent-500/50"
				>
					<span class="font-bold text-accent-400">AMRAP</span>
					<span class="text-xs text-text-muted">As Many Rounds As Possible</span>
				</Card>
			</a>
			<a href="/timers?type=emom">
				<Card
					class="flex flex-col gap-1 p-4 transition-transform hover:-translate-y-1 hover:border-accent-500/50"
				>
					<span class="font-bold text-accent-400">EMOM</span>
					<span class="text-xs text-text-muted">Every Minute On Minute</span>
				</Card>
			</a>
			<a href="/timers?type=fortime">
				<Card
					class="flex flex-col gap-1 p-4 transition-transform hover:-translate-y-1 hover:border-accent-500/50"
				>
					<span class="font-bold text-accent-400">FOR TIME</span>
					<span class="text-xs text-text-muted">Complete as fast as possible</span>
				</Card>
			</a>
			<a href="/timers?type=tabata">
				<Card
					class="flex flex-col gap-1 p-4 transition-transform hover:-translate-y-1 hover:border-accent-500/50"
				>
					<span class="font-bold text-accent-400">TABATA</span>
					<span class="text-xs text-text-muted">High intensity intervals</span>
				</Card>
			</a>
		</div>
	</section>

	<!-- Recent Workouts -->
	<section class="flex flex-col gap-4">
		<div class="flex items-center gap-3">
			<h2 class="text-lg font-bold tracking-wide text-text-primary uppercase">Recent Workouts</h2>
			<div class="h-[2px] flex-1 bg-white/5"></div>
		</div>

		{#if loading}
			<div class="space-y-3">
				{#each Array(3) as _, i}
					<Card class="h-20">
						<Skeleton variant="text" height="100%" width="100%" />
					</Card>
				{/each}
			</div>
		{:else if recentWoDs.length > 0}
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
				{#each recentWoDs as wod}
					<a href="/workouts/{wod.id}" class="block">
						<Card
							class="group flex items-center gap-4 px-4 py-3 transition-all hover:border-accent-500/30 hover:bg-white/5"
						>
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-800 text-accent-400 transition-transform group-hover:scale-110"
							>
								<span class="text-xs font-bold">{new Date(wod.date).getDate()}</span>
							</div>
							<div class="min-w-0 flex-1">
								<div class="text-xs tracking-wider text-text-muted uppercase">
									{new Date(wod.date).toLocaleDateString('en-US', { month: 'short' })}
								</div>
								<div
									class="truncate text-sm font-medium text-text-secondary transition-colors group-hover:text-text-primary"
								>
									{getPreviewText(wod)}
								</div>
							</div>
							<div
								class="text-text-muted transition-all group-hover:translate-x-1 group-hover:text-accent-400"
							>
								<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
									<path
										d="M9 18l6-6-6-6"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</div>
						</Card>
					</a>
				{/each}
			</div>
		{:else}
			<div class="py-8 text-center text-sm text-text-muted">No recent workouts found.</div>
		{/if}
	</section>
</div>
