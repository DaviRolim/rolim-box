<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { diffDays, formatLong, formatShort, todayIso } from '$lib/date';
	import { wodStore } from '$lib/stores/wods.svelte';
	import { syncStore } from '$lib/stores/sync.svelte';
	import { wodTitle } from '$lib/wod-format';
	import Icon from '$lib/components/ui/Icon.svelte';
	import WeekStrip from '$lib/components/wod/WeekStrip.svelte';
	import WodView from '$lib/components/wod/WodView.svelte';
	import DuplicateSheet from '$lib/components/wod/DuplicateSheet.svelte';

	let { data } = $props();

	const REVEALED = 'rolimbox:revealed';

	let today = $state(todayIso());
	let selected = $state(todayIso());
	let pick = $state(0);
	let duplicateOpen = $state(false);
	let seen = $state(readSeen());

	function readSeen(): string | null {
		if (!browser) return null;
		try {
			return localStorage.getItem(REVEALED);
		} catch {
			return null; // storage blocked: the reveal simply plays every time
		}
	}

	const marked = $derived(new Set(wodStore.wods.map((w) => w.date)));
	const wods = $derived(wodStore.onDate(selected));
	const wod = $derived(wods[Math.min(pick, wods.length - 1)] ?? null);
	const isToday = $derived(selected === today);

	// The first open of the day gets the full arrival; after that the board is simply there.
	const revealKey = $derived(wod && isToday ? `${today}:${wod.id}` : null);
	const reveal = $derived(revealKey !== null && seen !== revealKey);

	$effect(() => {
		if (!reveal || !revealKey) return;
		const key = revealKey;
		const timeout = setTimeout(() => {
			seen = key;
			try {
				localStorage.setItem(REVEALED, key);
			} catch {
				// private mode: it just plays again next time
			}
		}, 1600);
		return () => clearTimeout(timeout);
	});

	// A phone left open overnight should wake up on the new day.
	$effect(() => {
		const onVisible = () => {
			if (document.visibilityState !== 'visible') return;
			const now = todayIso();
			if (now !== today) {
				if (selected === today) selected = now;
				today = now;
			}
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});

	$effect(() => {
		void selected;
		pick = 0;
	});

	const nextUp = $derived(
		[...wodStore.wods].reverse().find((w) => w.date > selected && w.date >= today) ?? null
	);
	const neverLoaded = $derived(
		wodStore.stale && wodStore.wods.length === 0 && !wodStore.loading && !!data.activeWorkspaceId
	);
	const away = $derived(diffDays(today, selected));
</script>

<svelte:head>
	<title>{isToday ? 'Today' : formatShort(selected)} - RolimBox</title>
</svelte:head>

<WeekStrip bind:selected {today} {marked} />

<div class="page">
	{#if !isToday}
		<div class="mb-4 flex items-center justify-between gap-3">
			<p class="legend text-dim">
				{away > 0
					? `In ${away} ${away === 1 ? 'day' : 'days'}`
					: `${-away} ${away === -1 ? 'day' : 'days'} ago`}
			</p>
			<button type="button" class="btn btn-sm btn-quiet" onclick={() => (selected = today)}>
				<Icon name={away > 0 ? 'arrow-left' : 'arrow-right'} size={16} stroke={3} />
				Back to today
			</button>
		</div>
	{/if}

	{#if wodStore.loading}
		<!-- Loading: the shape of the poster, drawn in unlit LEDs. -->
		<div
			class="grid gap-8 lg:grid-cols-[5fr_7fr] lg:gap-12"
			aria-busy="true"
			aria-label="Loading the WoD"
		>
			<div>
				<p class="legend text-mute">Reading the board</p>
				<div class="led mt-3 h-28 w-full lg:h-40"></div>
				<div class="led mt-3 h-14 w-3/4"></div>
				<div class="led mt-5 h-10 w-1/2"></div>
			</div>
			<div class="flex flex-col gap-3">
				{#each [0, 1, 2, 3, 4] as row (row)}
					<div class="led h-12" style="width: {[100, 86, 92, 70, 80][row]}%"></div>
				{/each}
			</div>
		</div>
	{:else if wod}
		{#if wods.length > 1}
			<div class="mb-4 flex flex-wrap gap-2" role="group" aria-label="WoDs on this day">
				{#each wods as option, index (option.id)}
					<button
						type="button"
						class="tag min-h-11 px-3 {index === pick ? 'tag-ink' : ''}"
						aria-pressed={index === pick}
						onclick={() => (pick = index)}
					>
						{index + 1} · {wodTitle(option)}
					</button>
				{/each}
			</div>
		{/if}

		<WodView {wod} {reveal}>
			{#snippet tools()}
				{#if data.canEdit}
					<a href={resolve('/(app)/workouts/[id]/edit', { id: wod.id })} class="btn btn-quiet">
						<Icon name="edit" size={18} stroke={2.6} />
						Edit
					</a>
					<button type="button" class="btn btn-quiet" onclick={() => (duplicateOpen = true)}>
						<Icon name="copy" size={18} stroke={2.6} />
						Duplicate
					</button>
				{/if}
			{/snippet}
		</WodView>
	{:else if neverLoaded}
		<div class="empty">
			<p class="legend text-warn-ink">
				{syncStore.isOffline ? 'Offline' : 'No answer from the server'}
			</p>
			<h1 class="mt-3 display text-[3.5rem] lg:text-[5rem]">The board is blank</h1>
			<p class="mt-4 max-w-md text-lg leading-snug text-dim">
				This phone has not saved any WoDs yet and the server cannot be reached. Connect once and
				everything will be here next time, signal or not.
			</p>
			<button type="button" class="btn btn-ink mt-6" onclick={() => wodStore.refresh()}>
				<Icon name="refresh" size={18} stroke={2.6} />
				{wodStore.refreshing ? 'Trying' : 'Try again'}
			</button>
		</div>
	{:else}
		<div class="empty gridlines">
			<p class="rest sign" lang="pt-BR">Descanso?</p>
			<h1 class="mt-5 display text-[3.5rem] lg:text-[5rem]">Nothing on the board</h1>
			<p class="mt-3 max-w-md text-lg leading-snug text-dim">
				{#if data.canEdit}
					No WoD is programmed for {formatLong(selected)}.
				{:else if selected < today}
					There was no WoD on {formatLong(selected)}.
				{:else}
					The coaches have not posted {isToday
						? "today's WoD"
						: `a WoD for ${formatLong(selected)}`} yet. It shows up here the moment they do.
				{/if}
			</p>
			<div class="mt-6 flex flex-wrap gap-2">
				{#if data.canEdit}
					<a href="{resolve('/workouts/new')}?date={selected}" class="btn btn-pink">
						<Icon name="plus" size={20} stroke={3.2} />
						Program {isToday ? 'today' : formatShort(selected)}
					</a>
				{/if}
				{#if nextUp}
					<button type="button" class="btn btn-quiet" onclick={() => (selected = nextUp.date)}>
						Next up: {formatShort(nextUp.date)} · {wodTitle(nextUp)}
						<Icon name="arrow-right" size={18} stroke={3} />
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<DuplicateSheet {wod} bind:open={duplicateOpen} onduplicated={(copy) => (selected = copy.date)} />

<style>
	.page {
		padding: 1.25rem calc(1rem + var(--safe-right)) 0 calc(1rem + var(--safe-left));
		max-width: 84rem;
	}
	.empty {
		padding: 2rem 1.25rem 2.25rem;
		border: 2px solid var(--c-line-strong);
		background-color: var(--c-bg);
	}
	.rest {
		display: inline-block;
		font-size: 3.25rem;
		color: var(--c-pink-ink);
		transform: rotate(-4deg);
		transform-origin: left bottom;
	}
	@media (min-width: 1024px) {
		.page {
			padding: 2rem 2.5rem 0;
		}
		.empty {
			padding: 3rem;
		}
	}
</style>
