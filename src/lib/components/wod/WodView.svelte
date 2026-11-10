<script lang="ts">
	import type { Snippet } from 'svelte';
	import { mainSection } from '$lib/wod-format';
	import { t } from '$lib/i18n';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Poster from './Poster.svelte';
	import SectionBlock from './SectionBlock.svelte';
	import Placar from './Placar.svelte';
	import type { WoD } from '$lib/types/wod';

	/** A whole WoD as athletes see it: the poster, then the running order. */
	interface Props {
		wod: WoD;
		reveal?: boolean;
		/** Extra actions under the poster (coach tools). */
		tools?: Snippet;
	}

	let { wod, reveal = false, tools }: Props = $props();

	let placarOpen = $state(false);
	const main = $derived(mainSection(wod));
</script>

<div class="view">
	<div class="lead">
		{#key wod.id}
			<Poster {wod} {reveal} />
		{/key}

		<div class="mt-6 flex flex-wrap gap-2">
			{#if wod.sections.length > 0}
				<button type="button" class="btn btn-ink flex-1" onclick={() => (placarOpen = true)}>
					<Icon name="expand" size={20} stroke={2.6} />
					{t.today.view.placarMode}
				</button>
			{/if}
			{@render tools?.()}
		</div>
	</div>

	<div class="order">
		<div class="module-head">
			<span>{t.today.view.runningOrder}</span>
			<span>{t.today.view.parts(wod.sections.length)}</span>
		</div>
		{#each wod.sections as section, index (section.id)}
			<SectionBlock {section} index={index + 1} main={section.id === main?.id} />
		{:else}
			<p class="border-t-2 border-ink py-6 text-lg text-dim">{t.today.view.noSections}</p>
		{/each}
	</div>
</div>

<Placar {wod} bind:open={placarOpen} />

<style>
	.view {
		display: grid;
		gap: 2rem;
	}
	.lead,
	.order {
		min-width: 0;
	}
	@media (min-width: 1024px) {
		.view {
			grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
			gap: 3rem;
			align-items: start;
		}
		.lead {
			position: sticky;
			top: 2rem;
		}
	}
</style>
