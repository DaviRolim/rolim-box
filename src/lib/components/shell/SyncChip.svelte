<script lang="ts">
	import { resolve } from '$app/paths';
	import { syncStore, type SyncStatus } from '$lib/stores/sync.svelte';
	import { t } from '$lib/i18n';

	/** The one-word state of this device's data, like a status lamp on an instrument. */
	const lamp: Record<SyncStatus, string> = {
		synced: 'bg-ok',
		syncing: 'bg-pink animate-blink',
		pending: 'bg-pink',
		offline: 'bg-warn',
		unreachable: 'bg-warn animate-blink',
		error: 'bg-danger'
	};

	/**
	 * `compact` (the phone top bar, which also carries the box name and EN | PT): when all is
	 * synced the green lamp says it alone; any state that needs attention still gets its word.
	 */
	let { compact = false }: { compact?: boolean } = $props();

	const label = $derived.by(() => {
		switch (syncStore.status) {
			case 'offline':
				return t.shell.sync.offline;
			case 'error':
				return t.shell.sync.refused(syncStore.failed.length);
			case 'unreachable':
				return t.shell.sync.unreachable;
			case 'syncing':
				return t.shell.sync.syncing;
			case 'pending':
				return t.shell.sync.pending(syncStore.pending);
			default:
				return t.shell.sync.synced;
		}
	});
</script>

<a
	href={resolve('/settings')}
	class="inline-flex min-h-11 items-center gap-2 px-1 legend text-dim no-underline"
	class:compact
	aria-label={t.shell.sync.aria(label)}
>
	<span class="h-2.5 w-2.5 flex-none {lamp[syncStore.status]}" aria-hidden="true"></span>
	{#if !(compact && syncStore.status === 'synced')}{label}{/if}
</a>

<style>
	/* The lamp alone still makes a 44px target. */
	.compact {
		min-width: 2.75rem;
		justify-content: center;
	}
</style>
