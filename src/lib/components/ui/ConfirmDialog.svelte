<script lang="ts">
	import Sheet from './Sheet.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		open: boolean;
		title: string;
		message: string;
		legend?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		busy?: boolean;
		onconfirm: () => void;
		oncancel?: () => void;
	}

	let {
		open = $bindable(),
		title,
		message,
		legend,
		confirmLabel,
		cancelLabel,
		danger = false,
		busy = false,
		onconfirm,
		oncancel
	}: Props = $props();

	function cancel() {
		open = false;
		oncancel?.();
	}
</script>

<Sheet bind:open {title} {legend} onclose={oncancel}>
	<p class="text-lg leading-snug text-dim">{message}</p>
	{#snippet actions()}
		<button
			type="button"
			class="btn {danger ? 'btn-danger' : 'btn-pink'}"
			disabled={busy}
			onclick={onconfirm}
		>
			{confirmLabel ?? t.common.confirm}
		</button>
		<button type="button" class="btn btn-quiet" onclick={cancel}
			>{cancelLabel ?? t.common.cancel}</button
		>
	{/snippet}
</Sheet>
