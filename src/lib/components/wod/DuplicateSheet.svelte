<script lang="ts">
	import { addDays, formatLong, isIsoDate, todayIso } from '$lib/date';
	import { wodTitle } from '$lib/wod-format';
	import { wodStore } from '$lib/stores/wods.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import type { WoD } from '$lib/types/wod';

	/** Copy a WoD onto another day. */
	interface Props {
		wod: WoD | null;
		open: boolean;
		onduplicated?: (copy: WoD) => void;
	}

	let { wod, open = $bindable(), onduplicated }: Props = $props();

	let date = $state(todayIso());
	let busy = $state(false);

	const today = todayIso();
	const quick = $derived([
		{ label: 'Today', value: today },
		{ label: 'Tomorrow', value: addDays(today, 1) },
		{ label: 'Same day next week', value: wod ? addDays(wod.date, 7) : addDays(today, 7) }
	]);
	const taken = $derived(isIsoDate(date) ? wodStore.onDate(date) : []);

	$effect(() => {
		if (open) date = wod && wod.date < today ? today : addDays(today, 1);
	});

	async function confirm() {
		if (!wod || !isIsoDate(date)) return;
		busy = true;
		try {
			const copy = await wodStore.duplicate(wod.id, date);
			toastStore.success(`Copied to ${formatLong(date)}.`);
			open = false;
			onduplicated?.(copy);
		} catch (error) {
			console.error('Failed to duplicate WoD:', error);
			toastStore.error('Could not duplicate this WoD.');
		} finally {
			busy = false;
		}
	}
</script>

<Sheet bind:open title="Duplicate" legend={wod ? wodTitle(wod) : undefined}>
	<form
		id="duplicate-form"
		onsubmit={(event) => {
			event.preventDefault();
			void confirm();
		}}
	>
		<label for="duplicate-date" class="field-label">Copy to</label>
		<input id="duplicate-date" type="date" class="input" bind:value={date} required />

		<div class="mt-3 flex flex-wrap gap-2">
			{#each quick as option (option.label)}
				<button
					type="button"
					class="tag min-h-11 px-3 {date === option.value ? 'tag-ink' : ''}"
					aria-pressed={date === option.value}
					onclick={() => (date = option.value)}
				>
					{option.label}
				</button>
			{/each}
		</div>

		{#if taken.length > 0}
			<p class="notice notice-warn mt-4">
				{formatLong(date)} already has {taken.length === 1 ? 'a WoD' : `${taken.length} WoDs`}
				({taken.map((w) => wodTitle(w)).join(', ')}). The copy is added next to it.
			</p>
		{/if}
	</form>

	{#snippet actions()}
		<button
			type="submit"
			form="duplicate-form"
			class="btn btn-pink"
			disabled={busy || !isIsoDate(date)}
		>
			{busy ? 'Copying' : 'Duplicate WoD'}
		</button>
		<button type="button" class="btn btn-quiet" onclick={() => (open = false)}>Cancel</button>
	{/snippet}
</Sheet>
