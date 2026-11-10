<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { wodStore } from '$lib/stores/wods.svelte';
	import WodEditor from '$lib/components/editor/WodEditor.svelte';
	import { t } from '$lib/i18n';
	import type { WoD } from '$lib/types/wod';

	let { data } = $props();

	const id = $derived(page.params.id ?? '');

	// The editor needs a fixed starting point, so the WoD is resolved once and then handed over.
	let loaded = $state<{ id: string; wod: WoD | null | 'unavailable' } | null>(null);

	$effect(() => {
		const target = id;
		if (loaded?.id === target || wodStore.loading) return;
		let cancelled = false;
		wodStore.find(target).then((wod) => {
			if (!cancelled) loaded = { id: target, wod: wod === 'unavailable' ? wod : wod && { ...wod } };
		});
		return () => {
			cancelled = true;
		};
	});

	const result = $derived(loaded?.id === id ? loaded.wod : undefined);
</script>

<svelte:head>
	<title>{t.common.pageTitle(t.editor.pageTitleEdit)}</title>
</svelte:head>

{#if !data.canEdit}
	<div class="px-4 py-8 lg:px-10">
		<p class="legend text-mute">{t.editor.guard.coachesOnly}</p>
		<h1 class="mt-3 display text-[3.5rem]">{t.editor.guard.title}</h1>
		<p class="mt-3 max-w-md text-lg leading-snug text-dim">
			{t.editor.guard.cannotChange(data.activeWorkspace?.name ?? t.editor.guard.thisBox)}
		</p>
		<a href={resolve('/(app)/workouts/[id]', { id })} class="btn btn-ink mt-6"
			>{t.editor.guard.backToWod}</a
		>
	</div>
{:else if result === undefined}
	<div
		class="flex flex-col gap-3 px-4 py-6 lg:px-10"
		aria-busy="true"
		aria-label={t.editor.guard.loadingWod}
	>
		<div class="led h-14 w-2/3"></div>
		<div class="led h-28"></div>
		<div class="led h-40"></div>
	</div>
{:else if result === 'unavailable'}
	<div class="px-4 py-8 lg:px-10">
		<p class="legend text-warn-ink">{t.editor.guard.offline}</p>
		<h1 class="mt-3 display text-[3.5rem]">{t.editor.guard.notOnPhone}</h1>
		<p class="mt-3 max-w-md text-lg leading-snug text-dim">
			{t.editor.guard.notOnPhoneBody}
		</p>
		<a href={resolve('/workouts')} class="btn btn-ink mt-6">{t.editor.guard.allWods}</a>
	</div>
{:else if result === null}
	<div class="px-4 py-8 lg:px-10">
		<p class="inline-block -rotate-3 sign text-[3.25rem] text-pink-ink" lang="pt-BR">Sumiu.</p>
		<h1 class="mt-4 display text-[3.5rem]">{t.editor.guard.notFound}</h1>
		<p class="mt-3 max-w-md text-lg leading-snug text-dim">
			{t.editor.guard.notFoundBody}
		</p>
		<a href={resolve('/workouts')} class="btn btn-ink mt-6">{t.editor.guard.allWods}</a>
	</div>
{:else}
	{#key result.id}
		<WodEditor wod={result} workspaceId={result.workspaceId} aiEnabled={data.aiEnabled} />
	{/key}
{/if}
