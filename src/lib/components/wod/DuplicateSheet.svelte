<script lang="ts">
	import { addDays, formatLong, isIsoDate, todayIso } from '$lib/date';
	import { wodTitle } from '$lib/wod-format';
	import { wodStore } from '$lib/stores/wods.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import type { WoD } from '$lib/types/wod';
	import { t } from '$lib/i18n';

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
		{ key: 'today', label: t.today.duplicate.today, value: today },
		{ key: 'tomorrow', label: t.today.duplicate.tomorrow, value: addDays(today, 1) },
		{
			key: 'next-week',
			label: t.today.duplicate.sameDayNextWeek,
			value: wod ? addDays(wod.date, 7) : addDays(today, 7)
		}
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
			toastStore.success(t.today.duplicate.copied(formatLong(date)));
			open = false;
			onduplicated?.(copy);
		} catch (error) {
			console.error('Failed to duplicate WoD:', error);
			toastStore.error(t.today.duplicate.failed);
		} finally {
			busy = false;
		}
	}
</script>

<Sheet bind:open title={t.today.duplicate.title} legend={wod ? wodTitle(wod) : undefined}>
	<form
		id="duplicate-form"
		onsubmit={(event) => {
			event.preventDefault();
			void confirm();
		}}
	>
		<label for="duplicate-date" class="field-label">{t.today.duplicate.copyTo}</label>
		<input id="duplicate-date" type="date" class="input" bind:value={date} required />

		<div class="mt-3 flex flex-wrap gap-2">
			{#each quick as option (option.key)}
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
				{t.today.duplicate.alreadyHas(
					formatLong(date),
					taken.length,
					taken.map((w) => wodTitle(w)).join(', ')
				)}
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
			{busy ? t.today.duplicate.copying : t.today.duplicate.submit}
		</button>
		<button type="button" class="btn btn-quiet" onclick={() => (open = false)}
			>{t.today.duplicate.cancel}</button
		>
	{/snippet}
</Sheet>
