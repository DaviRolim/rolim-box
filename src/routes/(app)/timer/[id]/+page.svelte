<!-- src/routes/(app)/timer/[id]/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import { timerStore } from '$lib/stores/timer.svelte';
	import { TimerDisplay } from '$lib/components/timer';
	import { getWoD } from '$lib/services/wod';
	import { parseTimerConfig } from '$lib/types/timer';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		if (data.timerId === 'standalone') {
			// Config already set via timerStore.initialize() from config page
			if (!timerStore.config) {
				error = 'No timer configuration. Please configure a timer first.';
			}
			loading = false;
			// Wait for DOM to update before starting timer
			await tick();
			// Auto-start the timer for standalone mode
			if (timerStore.config && timerStore.state === 'idle') {
				timerStore.start();
			}
			return;
		}

		// Load from section
		try {
			// data.timerId is the sectionId - we need to find the WoD containing it
			// For now, we'll pass wodId and sectionId via URL params
			const url = new URL(window.location.href);
			const wodId = url.searchParams.get('wod');

			if (!wodId) {
				error = 'Missing workout reference';
				loading = false;
				return;
			}

			const wod = await getWoD(wodId);
			if (!wod) {
				error = 'Workout not found';
				loading = false;
				return;
			}

			const section = wod.sections.find((s) => s.id === data.timerId);
			if (!section) {
				error = 'Section not found';
				loading = false;
				return;
			}

			const config = parseTimerConfig(section.timerConfig);
			if (!config) {
				error = 'No timer configured for this section';
				loading = false;
				return;
			}

			timerStore.initialize(config, {
				sectionId: section.id,
				sectionName: section.name,
				wodId: wod.id
			});
		} catch (e) {
			error = 'Failed to load timer configuration';
			console.error(e);
		} finally {
			loading = false;
		}
	});

	function handleExit() {
		if (timerStore.context?.wodId) {
			goto(`/workouts/${timerStore.context.wodId}`);
		} else {
			goto('/timer');
		}
	}
</script>

<svelte:head>
	<title>Timer - RolimBox</title>
</svelte:head>

{#if loading}
	<div class="loading-container">
		<div class="loading-spinner"></div>
		<p>Loading timer...</p>
	</div>
{:else if error}
	<div class="error-container">
		<p class="error-message">{error}</p>
		<button type="button" class="btn-back" onclick={() => goto('/dashboard')}>
			Back to Dashboard
		</button>
	</div>
{:else}
	<TimerDisplay onExit={handleExit} />
{/if}

<style>
	.loading-container,
	.error-container {
		min-height: 100vh;
		background: #0a0a0a;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 24px;
		color: #a3a3a3;
		font-family: 'Inter', system-ui, sans-serif;
	}

	.loading-spinner {
		width: 48px;
		height: 48px;
		border: 4px solid #2a2a2a;
		border-top-color: #e91e8c;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-message {
		color: #ef4444;
		font-size: 16px;
		text-align: center;
		margin: 0;
	}

	.btn-back {
		padding: 14px 28px;
		background: transparent;
		border: 2px solid #6e489f;
		color: #6e489f;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-back:hover {
		background: #6e489f;
		color: #ffffff;
	}
</style>
