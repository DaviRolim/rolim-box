<script lang="ts">
	import { resolve } from '$app/paths';
	import { syncStore, type SyncStatus } from '$lib/stores/sync.svelte';

	/** The one-word state of this device's data, like a status lamp on an instrument. */
	const lamp: Record<SyncStatus, string> = {
		synced: 'bg-ok',
		syncing: 'bg-pink animate-blink',
		pending: 'bg-pink',
		offline: 'bg-warn',
		unreachable: 'bg-warn animate-blink',
		error: 'bg-danger'
	};

	const label = $derived.by(() => {
		switch (syncStore.status) {
			case 'offline':
				return 'Offline';
			case 'error':
				return `${syncStore.failed.length} refused`;
			case 'unreachable':
				return 'No server';
			case 'syncing':
				return 'Sending';
			case 'pending':
				return `${syncStore.pending} to send`;
			default:
				return 'Synced';
		}
	});
</script>

<a
	href={resolve('/settings')}
	class="inline-flex min-h-11 items-center gap-2 px-1 legend text-dim no-underline"
	aria-label="Sync status: {label}. Open settings."
>
	<span class="h-2.5 w-2.5 flex-none {lamp[syncStore.status]}" aria-hidden="true"></span>
	{label}
</a>
