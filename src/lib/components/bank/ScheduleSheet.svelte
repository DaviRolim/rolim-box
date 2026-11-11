<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		addDays,
		dayOfMonth,
		formatLong,
		formatShort,
		formatWeekday,
		isIsoDate,
		todayIso
	} from '$lib/date';
	import { wodTitle } from '$lib/wod-format';
	import { bankStore } from '$lib/stores/bank.svelte';
	import { wodStore } from '$lib/stores/wods.svelte';
	import { syncStore } from '$lib/stores/sync.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import type { BankWod } from '$lib/types/bank';
	import type { WoD } from '$lib/types/wod';
	import { t } from '$lib/i18n';

	/**
	 * The schedule step: put a bank WoD on a day. The next days are laid out like a scoreboard
	 * strip, with the ones that already have a WoD marked, and any other date can be typed.
	 * The bank entry stays; the day gets a copy.
	 */
	interface Props {
		item: BankWod | null;
		open: boolean;
		/** Day to start on (a day the coach was looking to fill). */
		initialDate?: string | null;
		/** Called with the new WoD instead of opening it. */
		onscheduled?: (wod: WoD) => void;
	}

	let { item, open = $bindable(), initialDate = null, onscheduled }: Props = $props();

	const today = todayIso();
	const DAYS = 7;

	let date = $state(today);
	let busy = $state(false);

	const nextDays = $derived(
		Array.from({ length: DAYS }, (_, offset) => {
			const day = addDays(today, offset);
			return { day, taken: wodStore.onDate(day).length > 0 };
		})
	);
	const taken = $derived(isIsoDate(date) ? wodStore.onDate(date) : []);
	const valid = $derived(isIsoDate(date));

	/** Start on the day asked for, or the first day from today with nothing on the board. */
	function startDay(): string {
		if (initialDate && isIsoDate(initialDate)) return initialDate;
		for (let offset = 0; offset < 14; offset++) {
			const day = addDays(today, offset);
			if (wodStore.onDate(day).length === 0) return day;
		}
		return today;
	}

	$effect(() => {
		if (open) date = startDay();
	});

	async function confirm() {
		if (!item || !valid || busy) return;
		busy = true;
		try {
			const idea = item.sections.length === 0;
			const wod = await bankStore.schedule(item, date);
			toastStore.success(
				syncStore.isOffline ? t.editor.toast.savedOffline : t.bank.schedule.done(formatLong(date))
			);
			open = false;
			if (onscheduled) onscheduled(wod);
			// A bare idea still needs its sections: open the copy in the editor.
			else if (idea) await goto(resolve('/(app)/workouts/[id]/edit', { id: wod.id }));
			else await goto(resolve('/(app)/workouts/[id]', { id: wod.id }));
		} catch (error) {
			console.error('Failed to put the bank WoD on a day:', error);
			toastStore.error(t.bank.schedule.failed);
		} finally {
			busy = false;
		}
	}
</script>

<Sheet bind:open title={t.bank.schedule.title} legend={item?.name}>
	<form
		id="schedule-form"
		onsubmit={(event) => {
			event.preventDefault();
			void confirm();
		}}
	>
		<p class="field-label" id="schedule-next">{t.bank.schedule.nextDays}</p>
		<div class="days" role="group" aria-labelledby="schedule-next">
			{#each nextDays as option (option.day)}
				<button
					type="button"
					class="day"
					class:on={date === option.day}
					class:today={option.day === today}
					aria-pressed={date === option.day}
					aria-label={t.bank.schedule.dayAria(formatLong(option.day), option.taken)}
					onclick={() => (date = option.day)}
				>
					<span class="legend text-[0.6875rem]"
						>{formatWeekday(option.day, 'short').slice(0, 3)}</span
					>
					<span class="display text-[1.75rem]">{dayOfMonth(option.day)}</span>
					<span class="mark legend" aria-hidden="true">
						{option.taken ? t.bank.schedule.hasWod : ''}
					</span>
				</button>
			{/each}
		</div>

		<label for="schedule-date" class="field-label mt-4">{t.bank.schedule.day}</label>
		<input id="schedule-date" type="date" class="input" bind:value={date} required />

		{#if taken.length > 0}
			<p class="notice notice-warn mt-4">
				{t.bank.schedule.alreadyHas(
					formatLong(date),
					taken.map((w) => `"${wodTitle(w)}"`).join(', ')
				)}
			</p>
		{/if}

		{#if item}
			<p class="mt-4 text-base leading-snug text-dim">
				{item.sections.length === 0
					? t.bank.schedule.copiesIdea
					: t.bank.schedule.copies(item.sections.length)}
			</p>
		{/if}
	</form>

	{#snippet actions()}
		<button
			type="submit"
			form="schedule-form"
			class="btn btn-pink"
			disabled={busy || !valid || !item}
		>
			{busy
				? t.bank.schedule.working
				: valid
					? t.bank.schedule.submit(formatShort(date))
					: t.bank.schedule.pickDay}
		</button>
		<button type="button" class="btn btn-quiet" onclick={() => (open = false)}
			>{t.bank.schedule.cancel}</button
		>
	{/snippet}
</Sheet>

<style>
	.days {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		border: 1px solid var(--c-line-strong);
	}
	.day {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
		min-height: 4.75rem;
		padding: 0.5rem 0 0.375rem;
		color: var(--c-ink);
	}
	.day + .day {
		border-left: 1px solid var(--c-line);
	}
	.day.today:not(.on) {
		box-shadow: inset 0 -3px 0 var(--c-pink);
	}
	.day.on {
		background: var(--c-ink);
		color: var(--c-bg);
	}
	.mark {
		min-height: 1em;
		font-size: 0.6875rem;
		color: var(--c-warn-ink);
	}
	.day.on .mark {
		color: inherit;
	}
	@media (hover: hover) {
		.day:not(.on):hover {
			background: var(--c-panel);
		}
	}
</style>
