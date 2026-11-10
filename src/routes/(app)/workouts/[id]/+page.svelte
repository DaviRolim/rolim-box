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
	import type { WoD } from '$lib/types/wod';

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
	let deleteOpen = $state(false);
	let deleting = $state(false);

	async function confirmDelete() {
		if (!wod) return;
		deleting = true;
		try {
			const title = wodTitle(wod);
			await wodStore.remove(wod.id);
			toastStore.success(`"${title}" deleted.`);
			deleteOpen = false;
			await goto(resolve('/workouts'));
		} catch (error) {
			console.error('Failed to delete WoD:', error);
			toastStore.error('Could not delete this WoD.');
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>{wod ? `${wodTitle(wod)} · ${formatShort(wod.date)}` : 'WoD'} - RolimBox</title>
</svelte:head>

<div class="page">
	<a
		href={resolve('/workouts')}
		class="inline-flex min-h-11 items-center gap-2 legend text-dim no-underline"
	>
		<Icon name="arrow-left" size={16} stroke={3} />
		All WoDs
	</a>

	<div class="mt-3">
		{#if wod}
			<WodView {wod}>
				{#snippet tools()}
					{#if data.canEdit}
						<a href={resolve('/(app)/workouts/[id]/edit', { id: wod.id })} class="btn btn-quiet">
							<Icon name="edit" size={18} stroke={2.6} />
							Edit
						</a>
						<button type="button" class="btn btn-quiet" onclick={() => (duplicateOpen = true)}>
							<Icon name="copy" size={18} stroke={2.6} />
							Duplicate
						</button>
						<button
							type="button"
							class="btn btn-quiet"
							onclick={() => (deleteOpen = true)}
							aria-label="Delete this WoD"
						>
							<Icon name="trash" size={18} stroke={2.6} />
							Delete
						</button>
					{/if}
				{/snippet}
			</WodView>
		{:else if searching}
			<div
				class="grid gap-8 lg:grid-cols-[5fr_7fr] lg:gap-12"
				aria-busy="true"
				aria-label="Loading the WoD"
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
				<p class="legend text-warn-ink">Offline</p>
				<h1 class="mt-3 display text-[3.5rem] lg:text-[5rem]">Not on this phone</h1>
				<p class="mt-3 max-w-md text-lg leading-snug text-dim">
					This WoD is not saved here and the server cannot be reached right now. It will open as
					soon as there is a connection.
				</p>
				<a href={resolve('/dashboard')} class="btn btn-ink mt-6">Back to today</a>
			</div>
		{:else}
			<div class="border-2 border-line-strong gridlines px-5 py-8 lg:p-12">
				<p class="inline-block -rotate-3 sign text-[3.25rem] text-pink-ink" lang="pt-BR">Sumiu.</p>
				<h1 class="mt-4 display text-[3.5rem] lg:text-[5rem]">WoD not found</h1>
				<p class="mt-3 max-w-md text-lg leading-snug text-dim">
					It may have been deleted, or it belongs to a box you are not in.
				</p>
				<div class="mt-6 flex flex-wrap gap-2">
					<a href={resolve('/workouts')} class="btn btn-ink">All WoDs</a>
					<a href={resolve('/dashboard')} class="btn btn-quiet">Today</a>
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

<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete this WoD?"
	legend={wod ? `${wodTitle(wod)} · ${formatLong(wod.date)}` : undefined}
	message="It disappears from everyone's board. This cannot be undone."
	confirmLabel={deleting ? 'Deleting' : 'Delete WoD'}
	cancelLabel="Keep it"
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
