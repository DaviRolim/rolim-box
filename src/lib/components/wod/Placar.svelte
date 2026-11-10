<script lang="ts">
	import { resolve } from '$app/paths';
	import { fitBox } from '$lib/actions/fit';
	import { sectionTypes } from '$lib/config/section-types';
	import { clock, mainSection, sectionTimer, timerChip } from '$lib/wod-format';
	import { getTotalDuration } from '$lib/types/timer';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Board from './Board.svelte';
	import type { WoD } from '$lib/types/wod';

	/**
	 * Placar mode: the phone as a scoreboard. One section fills the whole screen, scaled as large
	 * as it will go, so it can be read from the other side of the room. The screen stays awake.
	 */
	interface Props {
		wod: WoD;
		open: boolean;
		/** Section to start on. Defaults to the main WoD. */
		startAt?: string;
	}

	let { wod, open = $bindable(), startAt }: Props = $props();

	let index = $state(0);
	let closeButton = $state<HTMLButtonElement>();

	const main = $derived(mainSection(wod));
	const section = $derived(wod.sections[Math.min(index, wod.sections.length - 1)]);
	const timer = $derived(section ? sectionTimer(section) : null);
	const total = $derived(wod.sections.length);

	$effect(() => {
		if (!open) return;
		const target = startAt ?? main?.id;
		const found = wod.sections.findIndex((s) => s.id === target);
		index = found >= 0 ? found : 0;
	});

	// Keep the screen on while the board is up, and give it back afterwards.
	$effect(() => {
		if (!open || !('wakeLock' in navigator)) return;
		let lock: WakeLockSentinel | null = null;
		let cancelled = false;
		const acquire = () => {
			navigator.wakeLock
				.request('screen')
				.then((sentinel) => {
					if (cancelled) void sentinel.release();
					else lock = sentinel;
				})
				.catch(() => {});
		};
		const onVisible = () => {
			if (document.visibilityState === 'visible') acquire();
		};
		acquire();
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			cancelled = true;
			document.removeEventListener('visibilitychange', onVisible);
			void lock?.release();
		};
	});

	$effect(() => {
		if (open) closeButton?.focus();
	});

	function step(by: number) {
		index = Math.min(total - 1, Math.max(0, index + by));
	}

	function onKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			open = false;
		} else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			event.preventDefault();
			step(1);
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			event.preventDefault();
			step(-1);
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if open && section}
	<div class="placar" role="dialog" aria-modal="true" aria-label="Placar mode: {section.name}">
		<header class="flex items-center gap-3">
			<span class="count display" class:main={section.id === main?.id}>
				{String(index + 1).padStart(2, '0')}<span class="opacity-60"
					>/{String(total).padStart(2, '0')}</span
				>
			</span>
			<span class="min-w-0 flex-1 truncate legend text-dim">
				{sectionTypes[section.type].label}
			</span>
			{#if timer}
				<span class="tag">{timerChip(timer)}</span>
			{/if}
			<button
				bind:this={closeButton}
				type="button"
				class="icon-btn"
				onclick={() => (open = false)}
				aria-label="Close placar mode"
			>
				<Icon name="x" size={24} stroke={2.8} />
			</button>
		</header>

		<h2 class="title display">{section.name}</h2>

		{#key section.id}
			<div class="fill" use:fitBox={{ min: 20, max: 150 }}>
				<Board content={section.content} accent={section.id === main?.id} />
			</div>
		{/key}

		<footer class="foot">
			<button
				type="button"
				class="icon-btn step"
				onclick={() => step(-1)}
				disabled={index === 0}
				aria-label="Previous section"
			>
				<Icon name="chevron-left" size={30} stroke={3} />
			</button>
			{#if timer}
				<a
					href="{resolve('/(app)/timers/[id]', { id: section.id })}?wod={wod.id}"
					class="btn btn-pink btn-slab min-w-0 justify-between"
				>
					<span class="flex items-center gap-2">
						<span class="max-[430px]:hidden"><Icon name="play" solid size={22} /></span>
						Start clock
					</span>
					<span class="num">{clock(getTotalDuration(timer))}</span>
				</a>
			{:else}
				<div class="flex items-center justify-center legend text-mute" aria-hidden="true">
					No clock for this part
				</div>
			{/if}
			<button
				type="button"
				class="icon-btn step"
				onclick={() => step(1)}
				disabled={index >= total - 1}
				aria-label="Next section"
			>
				<Icon name="chevron-right" size={30} stroke={3} />
			</button>
		</footer>
	</div>
{/if}

<style>
	.placar {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: calc(0.75rem + var(--safe-top)) calc(1rem + var(--safe-right))
			calc(0.75rem + var(--safe-bottom)) calc(1rem + var(--safe-left));
		background: var(--c-bg);
		animation: var(--animate-shutter);
	}
	.count {
		padding: 0.14em 0.3em 0.02em;
		font-size: 1.75rem;
		line-height: 1;
		background: var(--c-ink);
		color: var(--c-bg);
	}
	.count.main {
		background: var(--c-pink);
		color: var(--c-on-fill);
	}
	.title {
		font-size: clamp(2.5rem, 11vw, 5.5rem);
		padding-bottom: 0.5rem;
		border-bottom: 4px solid var(--c-ink);
		overflow-wrap: anywhere;
	}
	.fill {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
	/* Never break a word here: a word that does not fit makes the whole board step down a size. */
	.fill :global(.text),
	.fill :global(.note),
	.fill :global(.heading) {
		overflow-wrap: normal;
	}
	.foot :global(.btn-slab) {
		padding-inline: 0.75rem;
		gap: 0.5rem;
		font-size: clamp(1.25rem, 5.6vw, 1.75rem);
	}
	.foot {
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 1fr) 4.5rem;
		gap: 0.5rem;
	}
	.step {
		width: 100%;
		height: 4.5rem;
		border-color: var(--c-ink);
	}
	@media (orientation: landscape) and (max-height: 520px) {
		.title {
			font-size: 2rem;
			padding-bottom: 0.25rem;
		}
		.placar {
			gap: 0.5rem;
		}
	}
</style>
