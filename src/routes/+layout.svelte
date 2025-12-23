<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
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
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#2D1B4E" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<link rel="apple-touch-icon" href="/icons/icon-192.png" />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

{@render children()}
