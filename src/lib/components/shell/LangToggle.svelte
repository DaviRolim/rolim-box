<script lang="ts">
	import { LOCALES, HTML_LANG, t } from '$lib/i18n';
	import { localeStore } from '$lib/i18n/store.svelte';

	/**
	 * EN | PT, like the language switch at the top of most websites: a square instrument
	 * legend, the active language filled in. Switching is instant (no reload) and remembered.
	 */
	interface Props {
		/** 'fill' sits on a solid pink block (the front door's wall). */
		tone?: 'ground' | 'fill';
		class?: string;
	}

	let { tone = 'ground', class: className = '' }: Props = $props();
</script>

<div
	class="lang {className}"
	class:fill={tone === 'fill'}
	role="group"
	aria-label={t.shell.language}
>
	{#each LOCALES as locale (locale)}
		{@const active = localeStore.current === locale}
		<button
			type="button"
			class="option"
			class:active
			aria-pressed={active}
			lang={HTML_LANG[locale]}
			title={t.shell.languageNames[locale]}
			onclick={() => localeStore.set(locale)}
		>
			{locale.toUpperCase()}
		</button>
	{/each}
</div>

<style>
	.lang {
		display: inline-flex;
		flex: none;
		height: 2.75rem;
		align-items: center;
	}
	.option {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 1.75rem;
		min-width: 2.25rem;
		padding: 0 0.375rem;
		border: 1px solid var(--c-line-strong);
		border-radius: 0;
		color: var(--c-dim);
		font-family: var(--font-mono);
		font-stretch: 75%;
		font-weight: 700;
		font-size: 0.75rem;
		line-height: 1;
		letter-spacing: 0.1em;
		/* the tracking adds space after the last letter: give it back so the text centres */
		text-indent: 0.1em;
		position: relative;
	}
	/* The touch target is the full 44px bar height, not just the visible box. */
	.option::after {
		content: '';
		position: absolute;
		inset: -0.5rem 0;
	}
	.option + .option {
		border-left: 0;
	}
	.option.active {
		border-color: var(--c-ink);
		background: var(--c-ink);
		color: var(--c-bg);
	}
	.fill .option {
		border-color: var(--c-on-fill);
		color: var(--c-on-fill);
	}
	.fill .option.active {
		background: var(--c-on-fill);
		color: var(--c-pink);
	}
	@media (hover: hover) {
		.lang:not(.fill) .option:not(.active):hover {
			color: var(--c-ink);
			border-color: var(--c-ink);
		}
	}
</style>
