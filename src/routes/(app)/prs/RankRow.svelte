<script lang="ts">
	import { t } from '$lib/i18n';

	/**
	 * One line of a timing tower: position block, athlete, figure. First place gets the pink
	 * block; the signed-in athlete's own line is marked so they find themselves at a glance.
	 */
	interface Props {
		rank: number;
		name: string;
		you?: boolean;
		/** The big number on the right. */
		figure: string;
		/** Small unit after the figure: "kg", "pts". */
		unit?: string;
		/** Mono line under the name (a date, a note). */
		sub?: string;
		/** 0..1: draws a bar under the name (share of the leader's points). */
		bar?: number;
		compact?: boolean;
	}

	let { rank, name, you = false, figure, unit = '', sub, bar, compact = false }: Props = $props();
</script>

<div class="rank-row" class:you class:compact>
	<span class="pos display" class:first={rank === 1}>{String(rank).padStart(2, '0')}</span>
	<span class="who">
		<span class="flex items-center gap-2">
			<span class="name display">{name}</span>
			{#if you}<span class="tag tag-ink flex-none">{t.prs.rankRow.you}</span>{/if}
		</span>
		{#if bar !== undefined}
			<span class="bar" aria-hidden="true"
				><span style="width: {Math.max(0, Math.min(1, bar)) * 100}%"></span></span
			>
		{/if}
		{#if sub}<span class="mt-1.5 block truncate legend text-mute">{sub}</span>{/if}
	</span>
	<span class="figure">
		<span class="display">{figure}</span>{#if unit}<span class="unit legend">{unit}</span>{/if}
	</span>
</div>

<style>
	.rank-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 4.25rem;
		padding: 0.5rem 0.5rem 0.5rem 0;
		border-top: 1px solid var(--c-line);
	}
	.rank-row.you {
		background: var(--c-panel);
		box-shadow: inset 0 0 0 2px var(--c-ink);
	}
	.pos {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		align-self: stretch;
		flex: none;
		width: 3.25rem;
		margin-block: -0.5rem;
		padding-top: 0.12em;
		font-size: 2rem;
		line-height: 1;
		background: var(--c-panel);
		color: var(--c-ink);
	}
	.you .pos {
		background: var(--c-ink);
		color: var(--c-bg);
	}
	.pos.first {
		background: var(--c-pink);
		color: var(--c-on-fill);
	}
	.who {
		display: block;
		min-width: 0;
		flex: 1;
	}
	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 1.75rem;
		line-height: 0.95;
		padding-top: 0.08em;
	}
	.bar {
		display: block;
		height: 0.375rem;
		margin-top: 0.375rem;
		background: var(--c-line);
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--c-ink);
	}
	.figure {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25rem;
		flex: none;
		white-space: nowrap;
	}
	.figure .display {
		font-size: 2.25rem;
		line-height: 0.9;
	}
	.unit {
		min-width: 3ch;
		color: var(--c-dim);
	}
	.compact {
		min-height: 3.5rem;
	}
	.compact .pos {
		width: 2.75rem;
		font-size: 1.625rem;
	}
	.compact .name {
		font-size: 1.5rem;
	}
	.compact .figure .display {
		font-size: 1.875rem;
	}
</style>
