<script lang="ts">
	import { parseBoard } from '$lib/wod-format';

	/**
	 * A section's text drawn the way a scoreboard would: one row per movement, the rep count in
	 * its own column, hairlines between rows. The size follows `--board-size` (see Placar mode).
	 */
	interface Props {
		content: string;
		/** The main WoD gets its numbers in pink. */
		accent?: boolean;
	}

	let { content, accent = false }: Props = $props();

	const lines = $derived(parseBoard(content));
</script>

<div class="board" class:accent>
	{#each lines as line, index (index)}
		{#if line.kind === 'gap'}
			<div class="gap"></div>
		{:else if line.kind === 'heading'}
			<p class="heading">{line.text}</p>
		{:else if line.kind === 'note'}
			<p class="note">{line.text}</p>
		{:else}
			<div class="row">
				<span class="qty">{line.qty ?? ''}</span>
				<span class="text">{line.text}</span>
			</div>
		{/if}
	{/each}
</div>

<style>
	.board {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		font-size: var(--board-size, 1.75rem);
	}
	.row {
		display: contents;
	}
	.qty,
	.text {
		padding: 0.24em 0 0.2em;
		border-bottom: 1px solid var(--c-line);
		font-family: var(--font-sans);
		text-transform: uppercase;
		font-variant-numeric: tabular-nums;
	}
	.qty {
		max-width: 46vw;
		padding-right: 0.5em;
		font-stretch: 62%;
		font-weight: 900;
		line-height: 1;
		text-align: right;
		white-space: nowrap;
		color: var(--c-ink);
	}
	.qty:empty {
		padding-right: 0;
	}
	.accent .qty {
		color: var(--c-pink-ink);
	}
	.text {
		font-stretch: 75%;
		font-weight: 700;
		line-height: 1;
		overflow-wrap: anywhere;
	}
	.heading {
		grid-column: 1 / -1;
		padding: 0.3em 0 0.24em;
		border-bottom: 2px solid var(--c-ink);
		font-family: var(--font-mono);
		font-stretch: 75%;
		font-weight: 700;
		font-size: max(0.5em, 0.8125rem);
		line-height: 1.25;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.note {
		grid-column: 1 / -1;
		padding: 0.45em 0 0.1em;
		font-size: max(0.6em, 1rem);
		font-weight: 500;
		line-height: 1.35;
		color: var(--c-dim);
	}
	.gap {
		grid-column: 1 / -1;
		height: 0.4em;
	}
</style>
