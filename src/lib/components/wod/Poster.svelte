<script lang="ts">
	import { fitText } from '$lib/actions/fit';
	import { formatShort, relativeDay } from '$lib/date';
	import { formatStrip, mainSection, sectionTimer, vaiDoer, wodTitle } from '$lib/wod-format';
	import type { WoD } from '$lib/types/wod';

	/**
	 * The reveal: the WoD's name across the full width, its format in a scoreboard strip, and the
	 * movement that is going to hurt on a strip of tape. Details come after, further down.
	 */
	interface Props {
		wod: WoD;
		/** Play the arrival sequence (first open of the day). */
		reveal?: boolean;
	}

	let { wod, reveal = false }: Props = $props();

	const title = $derived(wodTitle(wod));
	const main = $derived(mainSection(wod));
	const timer = $derived(main ? sectionTimer(main) : null);
	const strip = $derived(timer ? formatStrip(timer) : null);
	const hurts = $derived(vaiDoer(wod));
	const when = $derived(relativeDay(wod.date));
</script>

<div class="poster" class:reveal>
	<p class="stamp flex items-center justify-between gap-3 legend">
		<span>{formatShort(wod.date)}</span>
		{#if when}
			<span class="tag {when === 'Today' ? 'tag-pink' : 'tag-ink'}">{when}</span>
		{/if}
	</p>

	<h1 class="name display">
		<span use:fitText={{ max: 230, min: 64, key: title }}>{title}</span>
	</h1>

	{#if strip}
		<div class="strip" aria-label="Format: {strip[0]}, {strip[1]}">
			<span class="cell fill">{strip[0]}</span>
			<span class="cell">{strip[1]}</span>
		</div>
	{/if}

	{#if hurts}
		<p class="tape-wrap">
			<span class="tape">
				<span class="cap hazard" aria-hidden="true"></span>
				<span class="pt-1 sign text-[1.6rem] whitespace-nowrap" lang="pt-BR">Vai doer:</span>
				<span class="min-w-0 pt-1 display text-[2rem]">{hurts}</span>
				<span class="cap hazard" aria-hidden="true"></span>
			</span>
		</p>
	{/if}

	{#if wod.description?.trim()}
		<div class="brief">
			<p class="legend text-mute">From the coach</p>
			<p class="mt-2 text-lg leading-snug text-ink">{wod.description.trim()}</p>
		</div>
	{/if}
</div>

<style>
	.poster {
		container-type: inline-size;
	}
	.stamp {
		padding-bottom: 0.75rem;
		color: var(--c-dim);
	}
	.name {
		margin: 0;
		padding-top: 0.04em;
		font-size: clamp(4rem, 22cqw, 9rem);
		line-height: 0.82;
		overflow-wrap: anywhere;
		transform-origin: left bottom;
	}
	.strip {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		margin-top: 0.875rem;
		border: 2px solid var(--c-ink);
	}
	.cell {
		padding: 0.5rem 0.75rem 0.4rem;
		font-family: var(--font-sans);
		font-stretch: 62%;
		font-weight: 900;
		font-size: clamp(1.75rem, 9cqw, 2.75rem);
		line-height: 1;
		text-transform: uppercase;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cell.fill {
		background: var(--c-pink);
		color: var(--c-on-fill);
		border-right: 2px solid var(--c-ink);
	}
	.tape-wrap {
		margin-top: 1.125rem;
		padding-inline: 0.25rem;
	}
	.tape {
		--tilt: -2deg;
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		max-width: 100%;
		background: var(--c-warn);
		color: var(--c-on-fill);
		transform: rotate(var(--tilt));
		transform-origin: left center;
	}
	.cap {
		align-self: stretch;
		width: 1.125rem;
		min-height: 3rem;
		flex: none;
	}
	.brief {
		margin-top: 1.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--c-line-strong);
		max-width: 34rem;
	}

	/* The arrival: stamp, name, strip, tape, note, one beat apart. */
	.reveal .stamp {
		animation: var(--animate-shutter);
	}
	.reveal .name {
		animation: var(--animate-slam);
		animation-delay: 0.16s;
	}
	.reveal .strip {
		animation: var(--animate-shutter);
		animation-delay: 0.4s;
	}
	.reveal .tape {
		animation: var(--animate-slap);
		animation-delay: 0.62s;
	}
	.reveal .brief {
		animation: var(--animate-lift);
		animation-delay: 0.82s;
	}
</style>
