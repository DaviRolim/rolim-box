<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	/**
	 * A modal panel: slides up from the bottom edge on a phone (where thumbs are), sits in the
	 * middle of the screen on desktop. Built on <dialog>, so focus is trapped and Esc closes it.
	 */
	interface Props {
		open: boolean;
		title: string;
		/** Small mono line above the title. */
		legend?: string;
		/** Wider panel on desktop, for forms and tables. */
		wide?: boolean;
		onclose?: () => void;
		children: Snippet;
		/** Buttons pinned to the bottom of the panel. */
		actions?: Snippet;
	}

	let {
		open = $bindable(),
		title,
		legend,
		wide = false,
		onclose,
		children,
		actions
	}: Props = $props();

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function close() {
		open = false;
		onclose?.();
	}

	function onBackdrop(event: MouseEvent) {
		if (event.target === dialog) close();
	}
</script>

<dialog
	bind:this={dialog}
	class="sheet"
	class:wide
	aria-label={title}
	onclose={() => {
		if (open) close();
	}}
	oncancel={(event) => {
		event.preventDefault();
		close();
	}}
	onclick={onBackdrop}
>
	{#if open}
		<div class="panel">
			<header class="flex items-start justify-between gap-4 border-b-2 border-ink px-4 py-3">
				<div class="min-w-0">
					{#if legend}<p class="legend text-mute">{legend}</p>{/if}
					<h2 class="mt-1 display text-[2rem] break-words">{title}</h2>
				</div>
				<button type="button" class="icon-btn -mr-1" onclick={close} aria-label="Close">
					<Icon name="x" size={22} stroke={2.5} />
				</button>
			</header>
			<div class="body">
				{@render children()}
			</div>
			{#if actions}
				<footer class="foot">
					{@render actions()}
				</footer>
			{/if}
		</div>
	{/if}
</dialog>

<style>
	.sheet {
		position: fixed;
		inset: 0;
		width: 100%;
		max-width: none;
		height: 100%;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		overflow: hidden;
	}
	.sheet:not([open]) {
		display: none;
	}
	.sheet[open] {
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	.sheet::backdrop {
		background: color-mix(in srgb, #000 72%, transparent);
	}
	.panel {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-height: min(92dvh, 100%);
		background: var(--c-bg);
		border-top: 4px solid var(--c-pink);
		animation: var(--animate-sheet);
	}
	.body {
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 1rem;
	}
	.foot {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem 1rem calc(0.75rem + var(--safe-bottom));
		border-top: 1px solid var(--c-line);
	}
	@media (min-width: 768px) {
		.sheet[open] {
			align-items: center;
		}
		.panel {
			width: min(30rem, calc(100% - 3rem));
			max-height: min(86dvh, 100%);
			border: 2px solid var(--c-ink);
			border-top: 6px solid var(--c-pink);
			animation: var(--animate-lift);
		}
		.wide .panel {
			width: min(44rem, calc(100% - 3rem));
		}
		.foot {
			flex-direction: row-reverse;
			padding-bottom: 0.75rem;
		}
		.foot :global(.btn) {
			flex: 1;
		}
	}
</style>
