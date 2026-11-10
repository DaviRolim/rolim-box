<script lang="ts">
	import { resolve } from '$app/paths';
	import { sectionTypes } from '$lib/config/section-types';
	import { sectionTimer, timerChip } from '$lib/wod-format';
	import { getTotalDuration } from '$lib/types/timer';
	import { clock } from '$lib/wod-format';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Board from './Board.svelte';
	import { t } from '$lib/i18n';
	import type { Section } from '$lib/types/wod';

	interface Props {
		section: Section;
		/** Position in the running order, starting at 1. */
		index: number;
		/** The section people mean by "the WoD". */
		main?: boolean;
		/** Hide the "start clock" action (the editor preview has nowhere to go). */
		preview?: boolean;
	}

	let { section, index, main = false, preview = false }: Props = $props();

	const timer = $derived(sectionTimer(section));
	const type = $derived(sectionTypes[section.type]);
	const number = $derived(String(index).padStart(2, '0'));
</script>

<section class="block" class:main aria-labelledby="section-{section.id}">
	<header class="flex items-center gap-3">
		<span class="index display">{number}</span>
		<span class="min-w-0 flex-1 truncate legend text-dim">{type.label}</span>
		{#if timer}
			<span class="tag {main ? 'tag-pink' : ''}">{timerChip(timer)}</span>
		{/if}
	</header>

	<h3 id="section-{section.id}" class="mt-3 display text-[2.5rem] break-words lg:text-[3rem]">
		{section.name}
	</h3>

	{#if section.content.trim()}
		<div class="mt-3">
			<Board content={section.content} accent={main} />
		</div>
	{/if}

	{#if timer && !preview}
		<a
			href="{resolve('/(app)/timers/[id]', { id: section.id })}?wod={section.wodId}"
			class="btn mt-4 w-full justify-between {main ? 'btn-pink btn-slab' : ''}"
		>
			<span class="flex items-center gap-2.5">
				<Icon name="play" solid size={main ? 24 : 18} />
				{t.today.section.startClock}
			</span>
			<span class="num">{clock(getTotalDuration(timer))}</span>
		</a>
	{/if}
</section>

<style>
	.block {
		padding: 0.875rem 0 1.5rem;
		border-top: 2px solid var(--c-ink);
	}
	.index {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.25rem;
		height: 1.75rem;
		padding: 0.1em 0.3em 0;
		font-size: 1.5rem;
		line-height: 1;
		background: var(--c-ink);
		color: var(--c-bg);
	}
	.main {
		border-top: 6px solid var(--c-pink);
	}
	.main .index {
		background: var(--c-pink);
		color: var(--c-on-fill);
	}
</style>
