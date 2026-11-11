<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { formatLong, formatShort } from '$lib/date';
	import { wodStore } from '$lib/stores/wods.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { wodTitle } from '$lib/wod-format';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import WodView from '$lib/components/wod/WodView.svelte';
	import DuplicateSheet from '$lib/components/wod/DuplicateSheet.svelte';
	import SaveToBankSheet from '$lib/components/bank/SaveToBankSheet.svelte';
	import type { WoD } from '$lib/types/wod';
	import { t } from '$lib/i18n';

	let { data } = $props();

	const id = $derived(page.params.id ?? '');

	// The list usually has it already. If not (deep link, another box), look on the device and
	// then on the server.
	let looked = $state<{ id: string; result: WoD | null | 'unavailable' } | null>(null);
	const listed = $derived(wodStore.get(id));
	const wod = $derived(
		listed ?? (looked?.id === id && typeof looked.result === 'object' ? looked.result : null)
	);
	const searching = $derived(!wod && (wodStore.loading || looked?.id !== id));
	const unavailable = $derived(!wod && looked?.id === id && looked.result === 'unavailable');

	$effect(() => {
		const target = id;
		if (listed || wodStore.loading || looked?.id === target) return;
		let cancelled = false;
		wodStore.find(target).then((result) => {
			if (!cancelled) looked = { id: target, result };
		});
		return () => {
			cancelled = true;
		};
	});

	let duplicateOpen = $state(false);
	let bankOpen = $state(false);
	let deleteOpen = $state(false);
	let deleting = $state(false);

	async function confirmDelete() {
		if (!wod) return;
		deleting = true;
		try {
			const title = wodTitle(wod);
			await wodStore.remove(wod.id);
			toastStore.success(t.today.remove.deleted(title));
			deleteOpen = false;
			await goto(resolve('/workouts'));
		} catch (error) {
			console.error('Failed to delete WoD:', error);
			toastStore.error(t.today.remove.failed);
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>{t.common.pageTitle(wod ? `${wodTitle(wod)} · ${formatShort(wod.date)}` : 'WoD')}</title>
</svelte:head>

<div class="page">
	<a
		href={resolve('/workouts')}
		class="inline-flex min-h-11 items-center gap-2 legend text-dim no-underline"
	>
		<Icon name="arrow-left" size={16} stroke={3} />
		{t.today.detail.allWods}
	</a>

	<div class="mt-3">
		{#if wod}
			<WodView {wod}>
				{#snippet tools()}
					{#if data.canEdit}
						<a href={resolve('/(app)/workouts/[id]/edit', { id: wod.id })} class="btn btn-quiet">
							<Icon name="edit" size={18} stroke={2.6} />
							{t.today.detail.edit}
						</a>
						<button type="button" class="btn btn-quiet" onclick={() => (duplicateOpen = true)}>
							<Icon name="copy" size={18} stroke={2.6} />
							{t.today.detail.duplicate}
						</button>
						<button type="button" class="btn btn-quiet" onclick={() => (bankOpen = true)}>
							<Icon name="archive" size={18} stroke={2.6} />
							{t.bank.save.button}
						</button>
						<button
							type="button"
							class="btn btn-quiet"
							onclick={() => (deleteOpen = true)}
							aria-label={t.today.detail.deleteAria}
						>
							<Icon name="trash" size={18} stroke={2.6} />
							{t.today.detail.delete}
						</button>
					{/if}
				{/snippet}
			</WodView>
		{:else if searching}
			<div
				class="grid gap-8 lg:grid-cols-[5fr_7fr] lg:gap-12"
				aria-busy="true"
				aria-label={t.today.detail.loadingAria}
			>
				<div>
					<div class="led h-28 w-full lg:h-40"></div>
					<div class="led mt-3 h-14 w-3/4"></div>
				</div>
				<div class="flex flex-col gap-3">
					{#each [100, 86, 92, 70] as width (width)}
						<div class="led h-12" style="width: {width}%"></div>
					{/each}
				</div>
			</div>
		{:else if unavailable}
			<div class="border-2 border-warn px-5 py-8 lg:p-12">
				<p class="legend text-warn-ink">{t.today.detail.offline}</p>
				<h1 class="mt-3 display text-[3.5rem] lg:text-[5rem]">{t.today.detail.notHereTitle}</h1>
				<p class="mt-3 max-w-md text-lg leading-snug text-dim">
					{t.today.detail.notHereBody}
				</p>
				<a href={resolve('/dashboard')} class="btn btn-ink mt-6">{t.today.detail.backToToday}</a>
			</div>
		{:else}
			<div class="border-2 border-line-strong gridlines px-5 py-8 lg:p-12">
				<p class="inline-block -rotate-3 sign text-[3.25rem] text-pink-ink" lang="pt-BR">Sumiu.</p>
				<h1 class="mt-4 display text-[3.5rem] lg:text-[5rem]">{t.today.detail.notFoundTitle}</h1>
				<p class="mt-3 max-w-md text-lg leading-snug text-dim">
					{t.today.detail.notFoundBody}
				</p>
				<div class="mt-6 flex flex-wrap gap-2">
					<a href={resolve('/workouts')} class="btn btn-ink">{t.today.detail.allWods}</a>
					<a href={resolve('/dashboard')} class="btn btn-quiet">{t.today.detail.today}</a>
				</div>
			</div>
		{/if}
	</div>
</div>

<DuplicateSheet
	{wod}
	bind:open={duplicateOpen}
	onduplicated={(copy) => goto(resolve('/(app)/workouts/[id]', { id: copy.id }))}
/>

<SaveToBankSheet {wod} bind:open={bankOpen} />

<ConfirmDialog
	bind:open={deleteOpen}
	title={t.today.remove.title}
	legend={wod ? `${wodTitle(wod)} · ${formatLong(wod.date)}` : undefined}
	message={t.today.remove.message}
	confirmLabel={deleting ? t.today.remove.deleting : t.today.remove.confirm}
	cancelLabel={t.today.remove.keep}
	danger
	busy={deleting}
	onconfirm={confirmDelete}
/>

<style>
	.page {
		padding: 0.5rem calc(1rem + var(--safe-right)) 0 calc(1rem + var(--safe-left));
		max-width: 84rem;
	}
	@media (min-width: 1024px) {
		.page {
			padding: 1.25rem 2.5rem 0;
		}
	}
</style>
