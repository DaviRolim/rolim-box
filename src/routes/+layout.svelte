<script lang="ts">
	import './layout.css';
	import { browser, dev } from '$app/environment';
	import '$lib/stores/theme.svelte';

	let { children } = $props();

	if (browser && 'serviceWorker' in navigator) {
		if (dev) {
			// A service worker in dev fights with Vite's hot reloading: make sure none is left over.
			navigator.serviceWorker.getRegistrations().then((registrations) => {
				for (const registration of registrations) registration.unregister();
			});
		} else {
			navigator.serviceWorker.register('/service-worker.js').catch((error) => {
				console.warn('Service worker registration failed:', error);
			});
		}
	}
</script>

{@render children()}
