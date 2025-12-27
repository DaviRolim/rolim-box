<script lang="ts">
	import './layout.css';
	import { browser } from '$app/environment';

	let { children } = $props();

	// Register service worker
	if (browser && 'serviceWorker' in navigator) {
		if (import.meta.env.PROD) {
			navigator.serviceWorker.register('/sw.js');
		} else {
			// In dev, a service worker can cause confusing caching/HMR behavior.
			// Proactively unregister any existing SW so Vite HMR works reliably.
			navigator.serviceWorker.getRegistrations().then((regs) => {
				for (const reg of regs) reg.unregister();
			});
		}
	}
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/favicon.png" />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#2D1B4E" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<link rel="apple-touch-icon" href="/icons/icon-192.png" />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

<div
	class="min-h-screen bg-bg-base font-sans text-text-primary antialiased selection:bg-accent-500 selection:text-white"
>
	<div
		class="relative z-10 mx-auto min-h-screen w-full max-w-md border-x border-white/5 bg-bg-surface shadow-2xl shadow-black md:max-w-7xl"
	>
		{@render children()}
	</div>

	<!-- Background Ambient Glow -->
	<div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
		<div
			class="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary-900/40 mix-blend-screen blur-[128px]"
		></div>
		<div
			class="bg-accent-900/20 absolute right-[-10%] bottom-[-10%] h-[500px] w-[500px] rounded-full mix-blend-screen blur-[128px]"
		></div>
	</div>
</div>
