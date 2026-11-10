<script lang="ts">
	import './layout.css';
	import { browser, dev } from '$app/environment';
	import { onMount } from 'svelte';
	import '$lib/stores/theme.svelte';
	import { localeStore } from '$lib/i18n/store.svelte';

	let { data, children } = $props();

	// Render in the language the server used (no hydration mismatch), then let a saved choice
	// win: a page served from the offline cache may have been stored before a switch.
	// svelte-ignore state_referenced_locally
	localeStore.init(data.locale);
	onMount(() => localeStore.restore());

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
