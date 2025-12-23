<!-- src/routes/(app)/timer/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { timerStore } from '$lib/stores/timer.svelte';
	import TimerConfigComponent from '$lib/components/timer/TimerConfig.svelte';
	import type { TimerConfig } from '$lib/types/timer';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let configComponent: { getConfig: () => TimerConfig } | undefined = $state();

	function handleStart() {
		if (!configComponent) return;
		const config = configComponent.getConfig();
		timerStore.initialize(config);
		goto('/timer/standalone');
	}

	function handleBack() {
		goto('/dashboard');
	}
</script>

<svelte:head>
	<title>Timer - RolimBox</title>
</svelte:head>

<div class="timer-page">
	<header class="page-header">
		<button type="button" class="btn-back" onclick={handleBack}>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M15 6L9 12L15 18" stroke-linecap="square" />
			</svg>
			<span>Back</span>
		</button>
		<h1 class="page-title">TIMER</h1>
		<div class="spacer"></div>
	</header>

	<main class="page-content">
		<TimerConfigComponent bind:this={configComponent} initialType={data.timerType} />

		<button type="button" class="btn-start" onclick={handleStart}>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
				<path d="M8 5v14l11-7z" />
			</svg>
			START TIMER
		</button>
	</main>
</div>

<style>
	.timer-page {
		min-height: 100vh;
		background: #0a0a0a;
		padding-bottom: 100px;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px;
		border-bottom: 3px solid #1a1a1a;
	}

	.btn-back {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		background: transparent;
		border: 2px solid #2a2a2a;
		color: #a3a3a3;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.15s ease;
		min-height: 48px;
	}

	.btn-back:hover {
		border-color: #6e489f;
		color: #6e489f;
	}

	.page-title {
		font-family: 'Impact', 'Oswald', 'Arial Narrow', sans-serif;
		font-size: 24px;
		font-weight: 900;
		letter-spacing: 0.05em;
		color: #ffffff;
		margin: 0;
	}

	.spacer {
		width: 100px;
	}

	.page-content {
		max-width: 500px;
		margin: 0 auto;
		padding: 32px 20px;
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.btn-start {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 20px 32px;
		background: linear-gradient(135deg, #e91e8c 0%, #be185d 100%);
		border: 2px solid #e91e8c;
		color: #ffffff;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 16px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.2s ease;
		min-height: 64px;
		box-shadow: 0 4px 16px rgba(233, 30, 140, 0.4);
	}

	.btn-start:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(233, 30, 140, 0.5);
	}

	.btn-start:active {
		transform: translateY(0);
	}

	@media (max-width: 640px) {
		.btn-back span {
			display: none;
		}

		.btn-back {
			padding: 12px;
		}

		.spacer {
			width: 48px;
		}
	}
</style>
