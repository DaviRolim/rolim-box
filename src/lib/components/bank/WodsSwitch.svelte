<script lang="ts">
	import { resolve } from '$app/paths';
	import { bankStore } from '$lib/stores/bank.svelte';
	import { wodStore } from '$lib/stores/wods.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n';

	/** Coaches' switch between the WoDs on the calendar and the bank of WoDs with no date. */
	interface Props {
		current: 'calendar' | 'bank';
	}

	let { current }: Props = $props();
</script>

<nav class="switch" aria-label={t.bank.switch.aria}>
	<a
		href={resolve('/workouts')}
		class:on={current === 'calendar'}
		aria-current={current === 'calendar' ? 'page' : undefined}
	>
		<Icon name="calendar" size={18} stroke={2.6} />
		<span>{t.bank.switch.calendar}</span>
		{#if !wodStore.loading}<span class="count">{wodStore.wods.length}</span>{/if}
	</a>
	<a
		href={resolve('/bank')}
		class:on={current === 'bank'}
		aria-current={current === 'bank' ? 'page' : undefined}
	>
		<Icon name="archive" size={18} stroke={2.6} />
		<span>{t.bank.switch.bank}</span>
		{#if !bankStore.loading}<span class="count">{bankStore.items.length}</span>{/if}
	</a>
</nav>

<style>
	.switch {
		display: grid;
		grid-template-columns: 1fr 1fr;
		border: 2px solid var(--c-ink);
	}
	.switch a {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 3rem;
		font-family: var(--font-mono);
		font-stretch: 75%;
		font-weight: 700;
		font-size: 0.8125rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--c-dim);
		text-decoration: none;
	}
	.switch a + a {
		border-left: 2px solid var(--c-ink);
	}
	.switch a.on {
		color: var(--c-bg);
		background: var(--c-ink);
	}
	.count {
		opacity: 0.7;
	}
	@media (hover: hover) {
		.switch a:not(.on):hover {
			color: var(--c-ink);
			background: var(--c-panel);
		}
	}
	@media (min-width: 1024px) {
		.switch {
			max-width: 26rem;
		}
	}
</style>
