<script lang="ts">
	import { addDays, dayOfMonth, formatLong, formatWeekday, weekDays } from '$lib/date';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n';

	/** Seven keys, Monday to Sunday. The lit one is the day on the board. */
	interface Props {
		selected: string;
		today: string;
		/** Dates that have a WoD. */
		marked: Set<string>;
	}

	let { selected = $bindable(), today, marked }: Props = $props();

	const days = $derived(weekDays(selected));
</script>

<div class="strip" role="group" aria-label={t.today.week.pickDay}>
	<button
		type="button"
		class="arrow"
		onclick={() => (selected = addDays(selected, -7))}
		aria-label={t.today.week.previousWeek}
	>
		<Icon name="chevron-left" size={20} stroke={3} />
	</button>
	{#each days as day (day)}
		<button
			type="button"
			class="day"
			class:selected={day === selected}
			class:today={day === today}
			aria-pressed={day === selected}
			aria-label="{formatLong(day)}{day === today ? t.today.week.todaySuffix : ''}{marked.has(day)
				? t.today.week.hasWod
				: t.today.week.nothing}"
			onclick={() => (selected = day)}
		>
			<span class="wd legend">{formatWeekday(day, 'short').slice(0, 3)}</span>
			<span class="dn display">{dayOfMonth(day)}</span>
			<span class="dot" class:on={marked.has(day)} aria-hidden="true"></span>
		</button>
	{/each}
	<button
		type="button"
		class="arrow"
		onclick={() => (selected = addDays(selected, 7))}
		aria-label={t.today.week.nextWeek}
	>
		<Icon name="chevron-right" size={20} stroke={3} />
	</button>
</div>

<style>
	.strip {
		display: grid;
		grid-template-columns: 2rem repeat(7, minmax(0, 1fr)) 2rem;
		border-bottom: 2px solid var(--c-ink);
	}
	.arrow {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--c-dim);
	}
	.day {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		min-height: 4.25rem;
		padding: 0.5rem 0 0.4rem;
		border-left: 1px solid var(--c-line);
		color: var(--c-dim);
	}
	.day:last-of-type {
		border-right: 1px solid var(--c-line);
	}
	.wd {
		font-size: 0.6875rem;
		letter-spacing: 0.06em;
	}
	.dn {
		font-size: 1.75rem;
		line-height: 0.9;
		color: var(--c-ink);
	}
	.dot {
		width: 0.375rem;
		height: 0.375rem;
		background: transparent;
	}
	.dot.on {
		background: currentColor;
	}
	.day.today .wd {
		color: var(--c-pink-ink);
	}
	.day.today::before {
		content: '';
		position: absolute;
		inset: 0 0 auto 0;
		height: 4px;
		background: var(--c-pink);
	}
	.day.selected {
		background: var(--c-ink);
		color: var(--c-bg);
	}
	.day.selected .dn,
	.day.selected.today .wd {
		color: var(--c-bg);
	}
	.day.selected.today {
		background: var(--c-pink);
		color: var(--c-on-fill);
	}
	.day.selected.today .dn,
	.day.selected.today .wd {
		color: var(--c-on-fill);
	}
	@media (min-width: 768px) {
		.strip {
			grid-template-columns: 3rem repeat(7, minmax(0, 1fr)) 3rem;
		}
		.day {
			flex-direction: row;
			justify-content: center;
			align-items: baseline;
			gap: 0.5rem;
			min-height: 3.5rem;
			padding: 0.75rem 0 0.5rem;
		}
		.dot {
			align-self: center;
		}
	}
</style>
