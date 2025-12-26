<script lang="ts">
	import { onMount } from 'svelte';
	import { audioService } from '$lib/services/audio.svelte';
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

<div class="min-h-screen bg-bg-base text-text-primary">
	<OfflineBanner />

	<header
		class="sticky top-0 z-50 border-b border-white/5 bg-bg-surface/50 px-4 py-4 backdrop-blur-md"
	>
		<div class="mx-auto flex max-w-6xl items-center justify-between">
			<a href="/dashboard" class="flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-600 font-black text-white shadow-lg shadow-accent-500/20"
				>
					R
				</div>
				<h1 class="text-xl font-black tracking-tighter text-white uppercase italic">RolimBox</h1>
			</a>
			<div class="flex items-center gap-4">
				<div class="hidden flex-col items-end sm:flex">
					<span class="text-[10px] font-bold tracking-widest text-accent-400 uppercase"
						>Workspace</span
					>
					<span class="text-xs font-medium text-text-secondary"
						>{data.user?.email?.split('@')[0]}</span
					>
				</div>
				<form action="/logout" method="POST">
					<button
						type="submit"
						class="glass-hover rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-xs font-bold tracking-wider text-text-muted uppercase transition-all hover:border-error/30 hover:bg-error/5 hover:text-error"
					>
						Logout
					</button>
				</form>
			</div>
		</div>
	</header>

	<main
		class="mx-auto min-h-[calc(100vh-140px)] max-w-6xl"
		style="padding-bottom: calc(var(--bottom-nav-min-height) + env(safe-area-inset-bottom) + 2rem)"
	>
		{@render children()}
	</main>

	<BottomNav />
</div>
