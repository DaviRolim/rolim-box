<!-- src/lib/components/timer/TimerControls.svelte -->
<script lang="ts">
	import type { TimerState, TimerType } from '$lib/types/timer';

	interface Props {
		state: TimerState;
		timerType: TimerType;
		onStart: () => void;
		onPause: () => void;
		onResume: () => void;
		onReset: () => void;
		onStop: () => void;
	}

	let { state, timerType, onStart, onPause, onResume, onReset, onStop }: Props = $props();

	const stopLabel = $derived(timerType === 'fortime' ? 'FINISH' : 'STOP');
</script>

<div class="timer-controls">
	{#if state === 'idle'}
		<button type="button" class="ctrl-btn ctrl-start" onclick={onStart}>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
				<path d="M8 5v14l11-7z" />
			</svg>
			START
		</button>
	{:else if state === 'running'}
		<button type="button" class="ctrl-btn ctrl-pause" onclick={onPause}>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
				<path d="M6 4h4v16H6zM14 4h4v16h-4z" />
			</svg>
			PAUSE
		</button>
		<button type="button" class="ctrl-btn ctrl-reset" onclick={onReset}>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M3 12a9 9 0 1 0 9-9M3 3v6h6" stroke-linecap="square" />
			</svg>
			RESET
		</button>
		<button type="button" class="ctrl-btn ctrl-stop" onclick={onStop}>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
				<rect x="6" y="6" width="12" height="12" />
			</svg>
			{stopLabel}
		</button>
	{:else if state === 'paused'}
		<button type="button" class="ctrl-btn ctrl-resume" onclick={onResume}>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
				<path d="M8 5v14l11-7z" />
			</svg>
			RESUME
		</button>
		<button type="button" class="ctrl-btn ctrl-reset" onclick={onReset}>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M3 12a9 9 0 1 0 9-9M3 3v6h6" stroke-linecap="square" />
			</svg>
			RESET
		</button>
		<button type="button" class="ctrl-btn ctrl-stop" onclick={onStop}>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
				<rect x="6" y="6" width="12" height="12" />
			</svg>
			{stopLabel}
		</button>
	{:else if state === 'completed'}
		<button type="button" class="ctrl-btn ctrl-reset" onclick={onReset}>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M3 12a9 9 0 1 0 9-9M3 3v6h6" stroke-linecap="square" />
			</svg>
			RESET
		</button>
	{/if}
</div>

<style>
	.timer-controls {
		display: flex;
		gap: 12px;
		padding: 16px 24px;
		background: #1a1a1a;
		border-top: 3px solid #2a2a2a;
	}

	.ctrl-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 16px 20px;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border: 2px solid;
		cursor: pointer;
		transition: all 0.15s ease;
		min-height: 56px;
	}

	.ctrl-start,
	.ctrl-resume {
		background: #e91e8c;
		border-color: #e91e8c;
		color: #ffffff;
	}

	.ctrl-start:hover,
	.ctrl-resume:hover {
		background: #f472b6;
		border-color: #f472b6;
	}

	.ctrl-pause {
		background: #6e489f;
		border-color: #6e489f;
		color: #ffffff;
	}

	.ctrl-pause:hover {
		background: #8b5fc9;
		border-color: #8b5fc9;
	}

	.ctrl-reset {
		background: transparent;
		border-color: #525252;
		color: #a3a3a3;
	}

	.ctrl-reset:hover {
		background: #2a2a2a;
		border-color: #737373;
		color: #ffffff;
	}

	.ctrl-stop {
		background: transparent;
		border-color: #ef4444;
		color: #ef4444;
	}

	.ctrl-stop:hover {
		background: #ef4444;
		color: #ffffff;
	}

	@media (max-width: 640px) {
		.timer-controls {
			flex-wrap: wrap;
		}

		.ctrl-btn {
			min-width: calc(50% - 6px);
		}

		.ctrl-start,
		.ctrl-resume {
			min-width: 100%;
		}
	}
</style>
