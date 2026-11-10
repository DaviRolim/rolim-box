<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		addDays,
		dayOfMonth,
		formatDayMonth,
		formatLong,
		formatWeekday,
		startOfWeek,
		todayIso,
		weekLabel
	} from '$lib/date';
	import { wodStore } from '$lib/stores/wods.svelte';
	import { syncStore } from '$lib/stores/sync.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import {
		mainSection,
		sectionTimer,
		timerChip,
		vaiDoer,
		wodSearchText,
		wodSummary,
		wodTitle
	} from '$lib/wod-format';
	import { TIMER_LABELS, TIMER_TYPES, type TimerType } from '$lib/types/timer';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import DuplicateSheet from '$lib/components/wod/DuplicateSheet.svelte';
	import type { WoD } from '$lib/types/wod';

	let { data } = $props();

	const PAGE = 60;
	const today = todayIso();

	let query = $state('');
	let format = $state<TimerType | null>(null);
	let limit = $state(PAGE);
	let selected = $state<WoD | null>(null);
	let actionsOpen = $state(false);
	let duplicateOpen = $state(false);
	let deleteOpen = $state(false);
	let deleting = $state(false);

	type Row = { kind: 'wod'; date: string; wod: WoD } | { kind: 'open'; date: string };

	const formatOf = (wod: WoD) => {
		const main = mainSection(wod);
		return main ? sectionTimer(main) : null;
	};

	const filtering = $derived(query.trim().length > 0 || format !== null);

	const matches = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return wodStore.wods.filter((wod) => {
			if (format && formatOf(wod)?.type !== format) return false;
			if (needle && !`${wodTitle(wod).toLowerCase()}\n${wodSearchText(wod)}`.includes(needle))
				return false;
			return true;
		});
	});

	// Coaches also see the days of this week that are still open, so a gap in the programming
	// is visible where it will happen.
	const rows = $derived.by(() => {
		const list: Row[] = matches
			.slice(0, limit)
			.map((wod) => ({ kind: 'wod', date: wod.date, wod }));
		if (data.canEdit && !filtering && !wodStore.loading) {
			const taken = new Set(wodStore.wods.map((w) => w.date));
			const end = addDays(startOfWeek(today), 6);
			for (let day = today; day <= end; day = addDays(day, 1)) {
				if (!taken.has(day)) list.push({ kind: 'open', date: day });
			}
			list.sort((a, b) => b.date.localeCompare(a.date));
		}
		return list;
	});

	const weeks = $derived.by(() => {
		const groups: { start: string; rows: Row[] }[] = [];
		for (const row of rows) {
			const start = startOfWeek(row.date);
			const last = groups[groups.length - 1];
			if (last && last.start === start) last.rows.push(row);
			else groups.push({ start, rows: [row] });
		}
		return groups;
	});

	function openActions(wod: WoD) {
		selected = wod;
		actionsOpen = true;
	}

	function askDuplicate(wod: WoD) {
		selected = wod;
		actionsOpen = false;
		duplicateOpen = true;
	}

	function askDelete(wod: WoD) {
		selected = wod;
		actionsOpen = false;
		deleteOpen = true;
	}

	async function confirmDelete() {
		if (!selected) return;
		deleting = true;
		try {
			const title = wodTitle(selected);
			await wodStore.remove(selected.id);
			toastStore.success(`"${title}" deleted.`);
			deleteOpen = false;
			selected = null;
		} catch (error) {
			console.error('Failed to delete WoD:', error);
			toastStore.error('Could not delete this WoD.');
		} finally {
			deleting = false;
		}
	}

	function subline(wod: WoD): string {
		const hurts = vaiDoer(wod);
		if (hurts) return hurts;
		return wodSummary(wod);
	}
</script>

<svelte:head>
	<title>WoDs - RolimBox</title>
</svelte:head>

<div class="page">
	<header class="flex items-end justify-between gap-4">
		<div class="min-w-0">
			<p class="legend text-mute">
				{#if wodStore.loading}
					Reading the board
				{:else}
					{wodStore.wods.length} on the board{wodStore.stale && !syncStore.isOffline
						? ' · could not refresh'
						: ''}
				{/if}
			</p>
			<h1 class="mt-2 display text-[4.5rem] lg:text-[6rem]">WoDs</h1>
		</div>
		{#if data.canEdit}
			<a href={resolve('/workouts/new')} class="btn btn-pink mb-1 flex-none lg:hidden">
				<Icon name="plus" size={20} stroke={3.4} />
				New WoD
			</a>
		{/if}
	</header>

	<div class="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
		<div class="relative lg:w-96">
			<label for="wod-search" class="sr-only">Search WoDs</label>
			<span class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mute">
				<Icon name="search" size={20} stroke={2.6} />
			</span>
			<input
				id="wod-search"
				type="search"
				class="input pl-11"
				placeholder="Search: fran, thrusters, emom"
				autocomplete="off"
				bind:value={query}
			/>
		</div>
		<div
			class="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0"
			role="group"
			aria-label="Format"
		>
			<button
				type="button"
				class="tag min-h-11 flex-none px-3 {format === null ? 'tag-ink' : ''}"
				aria-pressed={format === null}
				onclick={() => (format = null)}
			>
				All
			</button>
			{#each TIMER_TYPES as type (type)}
				<button
					type="button"
					class="tag min-h-11 flex-none px-3 {format === type ? 'tag-ink' : ''}"
					aria-pressed={format === type}
					onclick={() => (format = format === type ? null : type)}
				>
					{TIMER_LABELS[type]}
				</button>
			{/each}
		</div>
	</div>

	<div class="mt-6">
		{#if wodStore.loading}
			<div class="flex flex-col gap-2" aria-busy="true" aria-label="Loading WoDs">
				{#each [0, 1, 2, 3, 4, 5] as row (row)}
					<div class="led h-[4.5rem]"></div>
				{/each}
			</div>
		{:else if wodStore.wods.length === 0}
			<div class="border-2 border-line-strong gridlines px-5 py-8 lg:p-12">
				<p class="inline-block -rotate-3 sign text-[3rem] text-pink-ink" lang="pt-BR">Tá vazio.</p>
				<h2 class="mt-4 display text-[3rem] lg:text-[4rem]">No WoDs yet</h2>
				<p class="mt-3 max-w-md text-lg leading-snug text-dim">
					{#if wodStore.stale}
						The server cannot be reached and nothing is saved on this phone yet.
					{:else if data.canEdit}
						This box has an empty board. Program the first one and it shows up on everyone's phone.
					{:else}
						The coaches have not programmed anything in this box yet.
					{/if}
				</p>
				{#if wodStore.stale}
					<button type="button" class="btn btn-ink mt-6" onclick={() => wodStore.refresh()}>
						<Icon name="refresh" size={18} stroke={2.6} />
						Try again
					</button>
				{:else if data.canEdit}
					<a href={resolve('/workouts/new')} class="btn btn-pink mt-6">
						<Icon name="plus" size={20} stroke={3.4} />
						Program the first WoD
					</a>
				{/if}
			</div>
		{:else if matches.length === 0}
			<div class="border-2 border-line-strong px-5 py-8">
				<h2 class="display text-[2.5rem]">No match</h2>
				<p class="mt-2 text-lg text-dim">Nothing on the board matches that search.</p>
				<button
					type="button"
					class="btn btn-quiet mt-5"
					onclick={() => {
						query = '';
						format = null;
					}}
				>
					Clear search
				</button>
			</div>
		{:else}
			{#each weeks as week (week.start)}
				<section class="week">
					<div class="module-head">
						<h2>{weekLabel(week.start, today)}</h2>
						<span
							>{formatDayMonth(week.start, today)} – {formatDayMonth(
								addDays(week.start, 6),
								today
							)}</span
						>
					</div>
					<ul>
						{#each week.rows as row (row.kind === 'wod' ? row.wod.id : `open-${row.date}`)}
							<li
								class="row"
								class:is-today={row.date === today}
								class:is-future={row.date > today}
							>
								<div class="day">
									<span class="legend text-[0.6875rem]"
										>{formatWeekday(row.date, 'short').slice(0, 3)}</span
									>
									<span class="display text-[2rem]">{dayOfMonth(row.date)}</span>
								</div>

								{#if row.kind === 'wod'}
									{@const wod = row.wod}
									{@const timer = formatOf(wod)}
									<a href={resolve('/(app)/workouts/[id]', { id: wod.id })} class="what">
										<span class="block truncate display text-[2rem] lg:text-[2.25rem]"
											>{wodTitle(wod)}</span
										>
										<span class="mt-1.5 flex items-center gap-2 legend text-dim">
											{#if timer}<span class="flex-none text-ink">{timerChip(timer)}</span>{/if}
											{#if timer && subline(wod)}<span aria-hidden="true">/</span>{/if}
											<span class="truncate">{subline(wod)}</span>
										</span>
									</a>
									{#if data.canEdit}
										<div class="tools">
											<button
												type="button"
												class="icon-btn"
												onclick={() => askDuplicate(wod)}
												aria-label="Duplicate {wodTitle(wod)}, {formatLong(wod.date)}"
												title="Duplicate"
											>
												<Icon name="copy" size={20} stroke={2.4} />
											</button>
											<a
												href={resolve('/(app)/workouts/[id]/edit', { id: wod.id })}
												class="icon-btn"
												aria-label="Edit {wodTitle(wod)}, {formatLong(wod.date)}"
												title="Edit"
											>
												<Icon name="edit" size={20} stroke={2.4} />
											</a>
											<button
												type="button"
												class="icon-btn"
												onclick={() => askDelete(wod)}
												aria-label="Delete {wodTitle(wod)}, {formatLong(wod.date)}"
												title="Delete"
											>
												<Icon name="trash" size={20} stroke={2.4} />
											</button>
										</div>
										<button
											type="button"
											class="more"
											onclick={() => openActions(wod)}
											aria-label="Actions for {wodTitle(wod)}, {formatLong(wod.date)}"
										>
											<Icon name="more" size={24} stroke={3} />
										</button>
									{/if}
								{:else}
									<a href="{resolve('/workouts/new')}?date={row.date}" class="what open">
										<span class="flex items-center gap-2 legend text-dim">
											<Icon name="plus" size={14} stroke={3.4} />
											<span class="text-ink"
												>Program {row.date === today
													? 'today'
													: formatWeekday(row.date, 'long')}</span
											>
											<span class="text-mute max-sm:hidden">· nothing on the board yet</span>
										</span>
									</a>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/each}

			{#if matches.length > limit}
				<button type="button" class="btn btn-quiet mt-6 w-full" onclick={() => (limit += PAGE)}>
					Show older WoDs ({matches.length - limit} more)
				</button>
			{/if}
		{/if}
	</div>
</div>

<Sheet
	bind:open={actionsOpen}
	title={selected ? wodTitle(selected) : ''}
	legend={selected ? formatLong(selected.date) : undefined}
>
	{#if selected}
		{@const wod = selected}
		<div class="flex flex-col gap-2">
			<button type="button" class="btn justify-start" onclick={() => askDuplicate(wod)}>
				<Icon name="copy" size={20} stroke={2.6} />
				Duplicate
			</button>
			<button
				type="button"
				class="btn justify-start"
				onclick={() => {
					actionsOpen = false;
					void goto(resolve('/(app)/workouts/[id]/edit', { id: wod.id }));
				}}
			>
				<Icon name="edit" size={20} stroke={2.6} />
				Edit
			</button>
			<button type="button" class="btn btn-danger justify-start" onclick={() => askDelete(wod)}>
				<Icon name="trash" size={20} stroke={2.6} />
				Delete
			</button>
		</div>
	{/if}
</Sheet>

<DuplicateSheet wod={selected} bind:open={duplicateOpen} />

<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete this WoD?"
	legend={selected ? `${wodTitle(selected)} · ${formatLong(selected.date)}` : undefined}
	message="It disappears from everyone's board. This cannot be undone."
	confirmLabel={deleting ? 'Deleting' : 'Delete WoD'}
	cancelLabel="Keep it"
	danger
	busy={deleting}
	onconfirm={confirmDelete}
/>

<style>
	.page {
		padding: 1.5rem calc(1rem + var(--safe-right)) 0 calc(1rem + var(--safe-left));
		max-width: 64rem;
	}
	.week {
		border-top: 2px solid var(--c-ink);
		margin-bottom: 1.5rem;
	}
	.row {
		display: grid;
		grid-template-columns: 3.75rem minmax(0, 1fr) auto;
		align-items: stretch;
		min-height: 4.75rem;
		border-top: 1px solid var(--c-line);
	}
	.row:has(.open) {
		min-height: 3.5rem;
	}
	.row:has(.open) .day {
		flex-direction: row;
		gap: 0.375rem;
		align-items: baseline;
		padding-top: 0.75rem;
	}
	.row:has(.open) .day :global(.display) {
		font-size: 1.375rem;
	}
	.day {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding-top: 0.25rem;
		background: var(--c-panel);
		color: var(--c-ink);
	}
	.is-today .day {
		background: var(--c-pink);
		color: var(--c-on-fill);
	}
	.is-future .day {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--c-line-strong);
	}
	.what {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
		padding: 0.625rem 0.75rem 0.5rem 0.875rem;
		color: var(--c-ink);
		text-decoration: none;
	}
	.what.open {
		background-image: repeating-linear-gradient(-45deg, var(--c-line) 0 1px, transparent 1px 9px);
	}
	.tools {
		display: none;
	}
	.more {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.25rem;
		color: var(--c-dim);
		border-left: 1px solid var(--c-line);
	}
	@media (hover: hover) {
		.row:hover .what:not(.open) {
			background: var(--c-panel);
		}
		.what.open:hover {
			background-color: var(--c-panel);
		}
	}
	@media (min-width: 1024px) {
		.page {
			padding: 2.25rem 2.5rem 0;
		}
		.row {
			grid-template-columns: 4.5rem minmax(0, 1fr) auto;
		}
		.tools {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			padding-left: 0.75rem;
		}
		.more {
			display: none;
		}
	}
</style>
