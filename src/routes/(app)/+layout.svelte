<script lang="ts">
	import { onMount } from 'svelte';
	import { audioService } from '$lib/services/audio';
	import OfflineBanner from '$lib/components/OfflineBanner.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';

	let { data, children } = $props();

	onMount(() => {
		// Defer audio preloading to avoid blocking initial render
		if ('requestIdleCallback' in window) {
			requestIdleCallback(() => audioService.preload());
		} else {
			// Fallback for Safari
			setTimeout(() => audioService.preload(), 1000);
		}
	});
</script>

<div class="min-h-screen bg-secondary-900">
	<OfflineBanner />

	<header class="border-b border-gray-800 bg-secondary-800 px-4 py-3">
		<div class="mx-auto flex max-w-4xl items-center justify-between">
			<h1 class="text-xl font-bold text-white">RolimBox</h1>
			<div class="flex items-center gap-4">
				<span class="text-sm text-gray-400">{data.user?.email}</span>
				<form action="/logout" method="POST">
					<button type="submit" class="text-sm text-gray-400 transition hover:text-white">
						Logout
					</button>
				</form>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-4xl p-4 pb-24">
		{@render children()}
	</main>

	<BottomNav />
</div>
