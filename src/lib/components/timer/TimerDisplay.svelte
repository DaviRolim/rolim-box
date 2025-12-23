<!-- src/lib/components/timer/TimerDisplay.svelte -->
<script lang="ts">
	import { timerStore } from '$lib/stores/timer.svelte';
	import { TIMER_LABELS, formatTime } from '$lib/types/timer';
	import { audioService } from '$lib/services/audio';
	import CountdownOverlay from './CountdownOverlay.svelte';
	import TimerProgress from './TimerProgress.svelte';
	import RoundIndicator from './RoundIndicator.svelte';
	import TimerControls from './TimerControls.svelte';

	interface Props {
		onExit: () => void;
	}

	let { onExit }: Props = $props();

	let containerEl: HTMLElement;
	let wakeLock: WakeLockSentinel | null = null;

	async function enterFullscreen() {
		try {
			await containerEl?.requestFullscreen();
			if ('wakeLock' in navigator) {
				wakeLock = await navigator.wakeLock.request('screen');
			}
		} catch (e) {
			console.warn('Fullscreen or WakeLock not available:', e);
		}
	}

	async function exitFullscreen() {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			}
			wakeLock?.release();
			wakeLock = null;
		} catch (e) {
			console.warn('Exit fullscreen error:', e);
		}
	}

	function handleStart() {
		enterFullscreen();
		timerStore.start();
	}

	function handleExit() {
		exitFullscreen();
		timerStore.reset();
		onExit();
	}

	$effect(() => {
		return () => {
			exitFullscreen();
		};
	});
</script>

<div class="timer-display" bind:this={containerEl}>
	<!-- Header -->
	<header class="timer-header">
		<span class="timer-type">
			{timerStore.config ? TIMER_LABELS[timerStore.config.type] : ''}
			{#if timerStore.config?.type === 'fortime'}
				<span class="timer-cap">(cap: {formatTime(timerStore.config.duration!)})</span>
			{/if}
		</span>
		<div class="header-actions">
			<button
				type="button"
				class="mute-btn"
				onclick={() => audioService.toggleMute()}
				aria-label={audioService.isMuted ? 'Unmute' : 'Mute'}
			>
				{#if audioService.isMuted}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11 5L6 9H2v6h4l5 4V5z" />
						<line x1="23" y1="9" x2="17" y2="15" />
						<line x1="17" y1="9" x2="23" y2="15" />
					</svg>
				{:else}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11 5L6 9H2v6h4l5 4V5z" />
						<path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
					</svg>
				{/if}
			</button>
			<button type="button" class="exit-btn" onclick={handleExit} aria-label="Exit timer">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" stroke-linecap="square" />
				</svg>
			</button>
		</div>
	</header>

	<!-- Main display -->
	<main class="timer-main">
		{#if timerStore.state === 'completed'}
			<div class="completed-message">TIME!</div>
		{:else}
			<div class="time-display" class:counting-up={timerStore.config?.type === 'fortime'}>
				{timerStore.displayTime}
			</div>
		{/if}

		{#if timerStore.config && timerStore.state !== 'countdown'}
			<RoundIndicator
				timerType={timerStore.config.type}
				currentRound={timerStore.currentRound}
				totalRounds={timerStore.totalRounds}
				isWorkPhase={timerStore.isWorkPhase}
				completedRounds={timerStore.completedRounds}
				onIncrement={() => timerStore.incrementRounds()}
			/>
		{/if}
	</main>

	<!-- Progress -->
	{#if timerStore.state !== 'idle' && timerStore.state !== 'countdown'}
		<TimerProgress progress={timerStore.progress} />
	{/if}

	<!-- Controls -->
	{#if timerStore.config}
		<TimerControls
			state={timerStore.state}
			timerType={timerStore.config.type}
			onStart={handleStart}
			onPause={() => timerStore.pause()}
			onResume={() => timerStore.resume()}
			onReset={() => timerStore.reset()}
			onStop={() => timerStore.stop()}
		/>
	{/if}

	<!-- Countdown overlay -->
	<CountdownOverlay value={timerStore.countdownValue} />
</div>

<style>
	.timer-display {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background: #0a0a0a;
	}

	.timer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 24px;
		border-bottom: 2px solid #1a1a1a;
	}

	.timer-type {
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #e91e8c;
	}

	.timer-cap {
		color: #525252;
		font-weight: 600;
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.mute-btn {
		width: 48px;
		height: 48px;
		background: transparent;
		border: 2px solid #2a2a2a;
		color: #737373;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.mute-btn:hover {
		border-color: #e91e8c;
		color: #e91e8c;
	}

	.exit-btn {
		width: 48px;
		height: 48px;
		background: transparent;
		border: 2px solid #2a2a0a;
		color: #737373;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.exit-btn:hover {
		border-color: #ef4444;
		color: #ef4444;
	}

	.timer-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 32px;
		padding: 40px 24px;
	}

	.time-display {
		font-family: 'Impact', 'Oswald', 'Arial Narrow', sans-serif;
		font-size: clamp(80px, 20vw, 160px);
		font-weight: 900;
		color: #ffffff;
		line-height: 1;
		letter-spacing: 0.02em;
	}

	.time-display.counting-up {
		color: #6e489f;
	}

	.completed-message {
		font-family: 'Impact', 'Oswald', 'Arial Narrow', sans-serif;
		font-size: clamp(60px, 15vw, 120px);
		font-weight: 900;
		color: #e91e8c;
		text-transform: uppercase;
		animation: completePulse 1s ease-in-out infinite;
	}

	@keyframes completePulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.8;
			transform: scale(1.02);
		}
	}

	/* Fullscreen styles */
	:global(.timer-display:fullscreen) {
		background: #0a0a0a;
	}

	:global(.timer-display:fullscreen) .time-display {
		font-size: clamp(120px, 25vw, 240px);
	}

	@media (prefers-reduced-motion: reduce) {
		.completed-message {
			animation: none;
		}
	}
</style>
