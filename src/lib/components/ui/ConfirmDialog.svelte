<script lang="ts">
	import Sheet from './Sheet.svelte';

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
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
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
			{confirmLabel}
		</button>
		<button type="button" class="btn btn-quiet" onclick={cancel}>{cancelLabel}</button>
	{/snippet}
</Sheet>
