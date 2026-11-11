<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { formatLong, formatShort, isIsoDate, todayIso } from '$lib/date';
	import { bankStore } from '$lib/stores/bank.svelte';
	import { syncStore } from '$lib/stores/sync.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import {
		mainMovements,
		mainSection,
		sectionTimer,
		timerChip,
		wodSearchText
	} from '$lib/wod-format';
	import { bankWhen } from '$lib/bank';
	import { TIMER_LABELS, TIMER_TYPES, type TimerType } from '$lib/types/timer';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ScheduleSheet from '$lib/components/bank/ScheduleSheet.svelte';
	import WodsSwitch from '$lib/components/bank/WodsSwitch.svelte';
	import type { BankWod } from '$lib/types/bank';
	import { t } from '$lib/i18n';

	let { data } = $props();

	const today = todayIso();

	let query = $state('');
	let format = $state<TimerType | null>(null);
	let selected = $state<BankWod | null>(null);
	let actionsOpen = $state(false);
	let scheduleOpen = $state(false);
	let deleteOpen = $state(false);
	let deleting = $state(false);

	// Arriving from an open day on the calendar ("or pick from the bank"): that day is the target.
	const pickingFor = $derived.by(() => {
		const day = page.url.searchParams.get('for');
		return day && isIsoDate(day) ? day : null;
	});

	const formatOf = (item: BankWod) => {
		const main = mainSection(item);
		return main ? sectionTimer(main) : null;
	};

	const matches = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return bankStore.items.filter((item) => {
			if (format && formatOf(item)?.type !== format) return false;
			if (needle && !`${item.name.toLowerCase()}\n${wodSearchText(item)}`.includes(needle))
				return false;
			return true;
		});
	});

	/** One line that helps pick: the main movements, or the rough idea itself. */
	function gist(item: BankWod): string {
		const moves = mainMovements(item);
		if (moves.length > 0) return moves.join(' · ');
		return item.description?.trim().split('\n')[0] ?? '';
	}

	function whenLabel(item: BankWod): { text: string; tone: string } {
		const when = bankWhen(item.lastScheduledOn, today);
		switch (when.kind) {
			case 'never':
				return { text: t.bank.list.never, tone: 'text-mute' };
			case 'today':
				return { text: t.bank.list.onToday, tone: 'text-pink-ink' };
			case 'next':
				return { text: t.bank.list.nextOn(formatShort(when.date, today)), tone: 'text-ink' };
			case 'past':
				return { text: t.bank.list.lastOn(formatShort(when.date, today)), tone: 'text-dim' };
		}
	}

	function askSchedule(item: BankWod) {
		selected = item;
		actionsOpen = false;
		scheduleOpen = true;
	}

	function openActions(item: BankWod) {
		selected = item;
		actionsOpen = true;
	}

	function askDelete(item: BankWod) {
		selected = item;
		actionsOpen = false;
		deleteOpen = true;
	}

	async function confirmDelete() {
		if (!selected) return;
		deleting = true;
		try {
			const name = selected.name;
			await bankStore.remove(selected.id);
			toastStore.success(t.bank.remove.deleted(name));
			deleteOpen = false;
			selected = null;
		} catch (error) {
			console.error('Failed to delete bank WoD:', error);
			toastStore.error(t.bank.remove.failed);
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>{t.common.pageTitle(t.bank.pageTitle)}</title>
</svelte:head>

{#if !data.canEdit}
	<div class="page">
		<p class="legend text-mute">{t.editor.guard.coachesOnly}</p>
		<h1 class="mt-3 display text-[3.5rem]">{t.editor.guard.title}</h1>
		<p class="mt-3 max-w-md text-lg leading-snug text-dim">
			{t.bank.guard.body(data.activeWorkspace?.name ?? t.editor.guard.thisBox)}
		</p>
		<a href={resolve('/workouts')} class="btn btn-ink mt-6">{t.editor.guard.allWods}</a>
	</div>
{:else}
	<div class="page">
		<header class="flex items-end justify-between gap-4">
			<div class="min-w-0">
				<p class="legend text-mute">
					{#if bankStore.loading}
						{t.bank.list.readingBank}
					{:else}
						{t.bank.list.count(bankStore.items.length)}{bankStore.stale && !syncStore.isOffline
							? t.bank.list.couldNotRefresh
							: ''}
					{/if}
				</p>
				<h1 class="mt-2 display text-[4.5rem] lg:text-[6rem]">{t.bank.title}</h1>
			</div>
			<a href={resolve('/bank/new')} class="btn btn-pink mb-1 flex-none">
				<Icon name="plus" size={20} stroke={3.4} />
				{t.bank.list.newIdea}
			</a>
		</header>

		<div class="mt-5">
			<WodsSwitch current="bank" />
		</div>

		{#if pickingFor}
			<div class="notice notice-pink mt-4 items-center" role="status">
				<Icon name="calendar" size={20} stroke={2.6} />
				<p class="min-w-0 flex-1">{t.bank.list.pickingFor(formatLong(pickingFor))}</p>
				<a href={resolve('/bank')} class="btn btn-sm btn-quiet flex-none">
					{t.bank.list.stopPicking}
				</a>
			</div>
		{/if}

		<div class="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
			<div class="relative lg:w-96">
				<label for="bank-search" class="sr-only">{t.bank.list.search}</label>
				<span class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mute">
					<Icon name="search" size={20} stroke={2.6} />
				</span>
				<input
					id="bank-search"
					type="search"
					class="input pl-11"
					placeholder={t.bank.list.searchPlaceholder}
					autocomplete="off"
					bind:value={query}
				/>
			</div>
			<div
				class="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0"
				role="group"
				aria-label={t.bank.list.format}
			>
				<button
					type="button"
					class="tag min-h-11 flex-none px-3 {format === null ? 'tag-ink' : ''}"
					aria-pressed={format === null}
					onclick={() => (format = null)}
				>
					{t.bank.list.all}
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
			{#if bankStore.loading}
				<div class="flex flex-col gap-2" aria-busy="true" aria-label={t.bank.list.loadingAria}>
					{#each [0, 1, 2, 3, 4] as row (row)}
						<div class="led h-[5.5rem]"></div>
					{/each}
				</div>
			{:else if bankStore.items.length === 0}
				<div class="border-2 border-line-strong gridlines px-5 py-8 lg:p-12">
					<p class="inline-block -rotate-3 sign text-[3rem] text-pink-ink" lang="pt-BR">
						Pra um dia.
					</p>
					<h2 class="mt-4 display text-[3rem] lg:text-[4rem]">{t.bank.list.emptyTitle}</h2>
					<p class="mt-3 max-w-md text-lg leading-snug text-dim">
						{bankStore.stale ? t.bank.list.emptyStale : t.bank.list.emptyBody}
					</p>
					{#if bankStore.stale}
						<button type="button" class="btn btn-ink mt-6" onclick={() => bankStore.refresh()}>
							<Icon name="refresh" size={18} stroke={2.6} />
							{t.bank.list.tryAgain}
						</button>
					{:else}
						<a href={resolve('/bank/new')} class="btn btn-pink mt-6">
							<Icon name="plus" size={20} stroke={3.4} />
							{t.bank.list.firstIdea}
						</a>
					{/if}
				</div>
			{:else if matches.length === 0}
				<div class="border-2 border-line-strong px-5 py-8">
					<h2 class="display text-[2.5rem]">{t.bank.list.noMatchTitle}</h2>
					<p class="mt-2 text-lg text-dim">{t.bank.list.noMatch}</p>
					<button
						type="button"
						class="btn btn-quiet mt-5"
						onclick={() => {
							query = '';
							format = null;
						}}
					>
						{t.bank.list.clearSearch}
					</button>
				</div>
			{:else}
				<ul class="list">
					{#each matches as item (item.id)}
						{@const timer = formatOf(item)}
						{@const when = whenLabel(item)}
						<li class="row">
							<a href={resolve('/(app)/bank/[id]', { id: item.id })} class="what">
								<span class="block truncate display text-[2rem] lg:text-[2.25rem]">{item.name}</span
								>
								<span class="mt-1.5 flex items-center gap-2 legend text-dim">
									{#if timer}
										<span class="flex-none text-ink">{timerChip(timer)}</span>
									{:else if item.sections.length === 0}
										<span class="tag flex-none">{t.bank.list.idea}</span>
									{/if}
									{#if (timer || item.sections.length === 0) && gist(item)}
										<span aria-hidden="true">/</span>
									{/if}
									<span class="truncate">{gist(item)}</span>
								</span>
								<span class="mt-1.5 flex items-center gap-1.5 legend {when.tone}">
									<Icon name="clock" size={13} stroke={2.6} />
									{when.text}
								</span>
							</a>
							<div class="tools">
								<button
									type="button"
									class="btn btn-sm"
									onclick={() => askSchedule(item)}
									aria-label={t.bank.list.scheduleAria(item.name)}
								>
									<Icon name="calendar" size={18} stroke={2.6} />
									{t.bank.list.schedule}
								</button>
								<a
									href={resolve('/(app)/bank/[id]', { id: item.id })}
									class="icon-btn"
									aria-label={t.bank.list.editAria(item.name)}
									title={t.bank.list.edit}
								>
									<Icon name="edit" size={20} stroke={2.4} />
								</a>
								<button
									type="button"
									class="icon-btn"
									onclick={() => askDelete(item)}
									aria-label={t.bank.list.deleteAria(item.name)}
									title={t.bank.list.delete}
								>
									<Icon name="trash" size={20} stroke={2.4} />
								</button>
							</div>
							<div class="phone-tools">
								<button
									type="button"
									class="put"
									onclick={() => askSchedule(item)}
									aria-label={t.bank.list.scheduleAria(item.name)}
								>
									<Icon name="calendar" size={22} stroke={2.6} />
								</button>
								<button
									type="button"
									class="more"
									onclick={() => openActions(item)}
									aria-label={t.bank.list.actionsAria(item.name)}
								>
									<Icon name="more" size={24} stroke={3} />
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>

	<Sheet bind:open={actionsOpen} title={selected?.name ?? ''} legend={t.bank.title}>
		{#if selected}
			{@const item = selected}
			<div class="flex flex-col gap-2">
				<button type="button" class="btn btn-pink justify-start" onclick={() => askSchedule(item)}>
					<Icon name="calendar" size={20} stroke={2.6} />
					{t.bank.list.schedule}
				</button>
				<button
					type="button"
					class="btn justify-start"
					onclick={() => {
						actionsOpen = false;
						void goto(resolve('/(app)/bank/[id]', { id: item.id }));
					}}
				>
					<Icon name="edit" size={20} stroke={2.6} />
					{t.bank.list.edit}
				</button>
				<button type="button" class="btn btn-danger justify-start" onclick={() => askDelete(item)}>
					<Icon name="trash" size={20} stroke={2.6} />
					{t.bank.list.delete}
				</button>
			</div>
		{/if}
	</Sheet>

	<ScheduleSheet item={selected} bind:open={scheduleOpen} initialDate={pickingFor} />

	<ConfirmDialog
		bind:open={deleteOpen}
		title={t.bank.remove.title}
		legend={selected?.name}
		message={t.bank.remove.message}
		confirmLabel={deleting ? t.bank.remove.deleting : t.bank.remove.confirm}
		cancelLabel={t.bank.remove.keep}
		danger
		busy={deleting}
		onconfirm={confirmDelete}
	/>
{/if}

<style>
	.page {
		padding: 1.5rem calc(1rem + var(--safe-right)) 0 calc(1rem + var(--safe-left));
		max-width: 64rem;
	}
	.list {
		border-top: 2px solid var(--c-ink);
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: stretch;
		min-height: 5.75rem;
		border-bottom: 1px solid var(--c-line);
	}
	.what {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
		padding: 0.75rem 0.75rem 0.75rem 0.25rem;
		color: var(--c-ink);
		text-decoration: none;
	}
	.tools {
		display: none;
	}
	.phone-tools {
		display: flex;
	}
	.put,
	.more {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.25rem;
		color: var(--c-dim);
		border-left: 1px solid var(--c-line);
	}
	.put {
		color: var(--c-ink);
	}
	@media (hover: hover) {
		.row:hover .what {
			background: var(--c-panel);
		}
	}
	@media (min-width: 1024px) {
		.page {
			padding: 2.25rem 2.5rem 0;
		}
		.what {
			padding-left: 0.875rem;
		}
		.tools {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			padding-left: 0.75rem;
		}
		.phone-tools {
			display: none;
		}
	}
</style>
