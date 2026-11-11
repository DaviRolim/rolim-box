<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { bankStore } from '$lib/stores/bank.svelte';
	import WodEditor from '$lib/components/editor/WodEditor.svelte';
	import type { BankWod } from '$lib/types/bank';
	import { t } from '$lib/i18n';

	let { data } = $props();

	const id = $derived(page.params.id ?? '');

	// The editor needs a fixed starting point, so the bank WoD is resolved once and handed over.
	let loaded = $state<{ id: string; item: BankWod | null | 'unavailable' } | null>(null);

	$effect(() => {
		const target = id;
		if (!data.canEdit || loaded?.id === target || bankStore.loading) return;
		let cancelled = false;
		bankStore.find(target).then((item) => {
			if (!cancelled)
				loaded = { id: target, item: item === 'unavailable' ? item : item && { ...item } };
		});
		return () => {
			cancelled = true;
		};
	});

	const result = $derived(loaded?.id === id ? loaded.item : undefined);
</script>

<svelte:head>
	<title>{t.common.pageTitle(t.bank.editor.pageTitleEdit)}</title>
</svelte:head>

{#if !data.canEdit}
	<div class="px-4 py-8 lg:px-10">
		<p class="legend text-mute">{t.editor.guard.coachesOnly}</p>
		<h1 class="mt-3 display text-[3.5rem]">{t.editor.guard.title}</h1>
		<p class="mt-3 max-w-md text-lg leading-snug text-dim">
			{t.bank.guard.body(data.activeWorkspace?.name ?? t.editor.guard.thisBox)}
		</p>
		<a href={resolve('/dashboard')} class="btn btn-ink mt-6">{t.editor.guard.backToToday}</a>
	</div>
{:else if result === undefined}
	<div
		class="flex flex-col gap-3 px-4 py-6 lg:px-10"
		aria-busy="true"
		aria-label={t.editor.guard.loading}
	>
		<div class="led h-14 w-2/3"></div>
		<div class="led h-28"></div>
		<div class="led h-40"></div>
	</div>
{:else if result === 'unavailable'}
	<div class="px-4 py-8 lg:px-10">
		<p class="legend text-warn-ink">{t.editor.guard.offline}</p>
		<h1 class="mt-3 display text-[3.5rem]">{t.editor.guard.notOnPhone}</h1>
		<p class="mt-3 max-w-md text-lg leading-snug text-dim">{t.bank.guard.notOnPhoneBody}</p>
		<a href={resolve('/bank')} class="btn btn-ink mt-6">{t.bank.guard.backToBank}</a>
	</div>
{:else if result === null}
	<div class="px-4 py-8 lg:px-10">
		<p class="inline-block -rotate-3 sign text-[3.25rem] text-pink-ink" lang="pt-BR">Sumiu.</p>
		<h1 class="mt-4 display text-[3.5rem]">{t.bank.guard.notFound}</h1>
		<p class="mt-3 max-w-md text-lg leading-snug text-dim">{t.bank.guard.notFoundBody}</p>
		<a href={resolve('/bank')} class="btn btn-ink mt-6">{t.bank.guard.backToBank}</a>
	</div>
{:else}
	{#key result.id}
		<WodEditor
			mode="bank"
			bankWod={result}
			workspaceId={result.workspaceId}
			aiEnabled={data.aiEnabled}
		/>
	{/key}
{/if}
