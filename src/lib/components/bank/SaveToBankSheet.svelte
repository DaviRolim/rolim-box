<script lang="ts">
	import { formatLong } from '$lib/date';
	import { wodTitle } from '$lib/wod-format';
	import { bankStore } from '$lib/stores/bank.svelte';
	import { syncStore } from '$lib/stores/sync.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { BANK_NAME_MAX } from '$lib/types/bank';
	import type { WoD } from '$lib/types/wod';
	import { t } from '$lib/i18n';

	/** Keep a copy of a dated WoD in the bank, to put it on another day later. */
	interface Props {
		wod: WoD | null;
		open: boolean;
	}

	let { wod, open = $bindable() }: Props = $props();

	let name = $state('');
	let busy = $state(false);
	const valid = $derived(name.trim().length > 0 && name.trim().length <= BANK_NAME_MAX);

	$effect(() => {
		if (open && wod) name = wodTitle(wod).slice(0, BANK_NAME_MAX);
	});

	async function confirm() {
		if (!wod || !valid || busy) return;
		busy = true;
		try {
			const item = await bankStore.saveFromWod(wod, name);
			toastStore.success(
				syncStore.isOffline ? t.editor.toast.savedOffline : t.bank.save.done(item.name)
			);
			open = false;
		} catch (error) {
			console.error('Failed to save the WoD to the bank:', error);
			toastStore.error(t.bank.save.failed);
		} finally {
			busy = false;
		}
	}
</script>

<Sheet
	bind:open
	title={t.bank.save.title}
	legend={wod ? `${wodTitle(wod)} · ${formatLong(wod.date)}` : undefined}
>
	<form
		id="save-to-bank-form"
		onsubmit={(event) => {
			event.preventDefault();
			void confirm();
		}}
	>
		<label for="save-to-bank-name" class="field-label">{t.bank.save.name}</label>
		<input
			id="save-to-bank-name"
			type="text"
			class="input"
			autocomplete="off"
			bind:value={name}
			required
		/>
		{#if wod}
			<p class="mt-4 text-base leading-snug text-dim">
				{t.bank.save.copies(wod.sections.length, formatLong(wod.date))}
			</p>
		{/if}
	</form>

	{#snippet actions()}
		<button
			type="submit"
			form="save-to-bank-form"
			class="btn btn-pink"
			disabled={busy || !valid || !wod}
		>
			{busy ? t.bank.save.saving : t.bank.save.submit}
		</button>
		<button type="button" class="btn btn-quiet" onclick={() => (open = false)}
			>{t.bank.save.cancel}</button
		>
	{/snippet}
</Sheet>
