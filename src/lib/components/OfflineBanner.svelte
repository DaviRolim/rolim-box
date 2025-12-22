<script lang="ts">
	import { syncStore } from '$lib/stores/sync.svelte';
</script>

{#if syncStore.isOffline}
	<div class="bg-yellow-900/80 px-4 py-2 text-center text-sm text-yellow-200">
		You're offline - viewing cached data
	</div>
{/if}
