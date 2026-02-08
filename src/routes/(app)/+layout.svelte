<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { audioService } from '$lib/services/audio.svelte';
	import { clearAllCachedData } from '$lib/db/indexeddb';
	import OfflineBanner from '$lib/components/OfflineBanner.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import WorkspaceSwitcher from '$lib/components/WorkspaceSwitcher.svelte';

	let { data, children } = $props();

	onMount(() => {
		// Defer audio preloading to avoid blocking initial render
		if ('requestIdleCallback' in window) {
			requestIdleCallback(() => audioService.preload());
		} else {
			// Fallback for Safari
			setTimeout(() => audioService.preload(), 1000);
		}

		// Unlock AudioContext on first user interaction (required for iOS Safari)
		const unlock = () => audioService.unlockAudio();
		document.addEventListener('touchstart', unlock, { once: true });
		document.addEventListener('click', unlock, { once: true });
	});
</script>

<Toast />

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
				<div class="hidden sm:block">
					<WorkspaceSwitcher workspaces={data.workspaces} activeWorkspaceId={data.activeWorkspaceId} />
				</div>
				<a
					href="/settings"
					class="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/10 hover:text-white"
					title="Settings"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="3" />
						<path
							d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
						/>
					</svg>
				</a>
				<form
					action="/logout"
					method="POST"
					use:enhance={() => {
						clearAllCachedData().catch(() => {});
						if ('caches' in window) {
							caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
						}
					}}
				>
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
