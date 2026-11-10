<script lang="ts">
	import AuthFrame from '$lib/components/shell/AuthFrame.svelte';

	let { children } = $props();
</script>

<AuthFrame>
	{@render children()}
</AuthFrame>
