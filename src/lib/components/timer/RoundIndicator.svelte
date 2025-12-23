<!-- src/lib/components/timer/RoundIndicator.svelte -->
<script lang="ts">
	import type { TimerType } from '$lib/types/timer';

	interface Props {
		timerType: TimerType;
		currentRound: number;
		totalRounds: number;
		isWorkPhase?: boolean;
		completedRounds?: number;
		onIncrement?: () => void;
	}

	let {
		timerType,
		currentRound,
		totalRounds,
		isWorkPhase = true,
		completedRounds = 0,
		onIncrement
	}: Props = $props();

	const showManualCounter = timerType === 'amrap' || timerType === 'fortime';
	const showAutoRounds = timerType === 'emom' || timerType === 'tabata';
</script>

<div class="round-indicator">
	{#if showManualCounter}
		<div class="manual-counter">
			<span class="counter-label">ROUNDS</span>
			<div class="counter-row">
				<span class="counter-value">{completedRounds}</span>
				<button type="button" class="increment-btn" onclick={onIncrement} aria-label="Add round">
					<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
						<path d="M16 8v16M8 16h16" stroke="currentColor" stroke-width="3" stroke-linecap="square" />
					</svg>
				</button>
			</div>
		</div>
	{/if}

	{#if showAutoRounds}
		<div class="auto-rounds">
			<span class="rounds-text">Round {currentRound} of {totalRounds}</span>
			{#if timerType === 'tabata'}
				<span class="phase-badge" class:work={isWorkPhase} class:rest={!isWorkPhase}>
					{isWorkPhase ? 'WORK' : 'REST'}
				</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.round-indicator {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.manual-counter {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.counter-label {
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #737373;
	}

	.counter-row {
		display: flex;
		align-items: center;
		gap: 24px;
	}

	.counter-value {
		font-family: 'Impact', 'Oswald', sans-serif;
		font-size: 64px;
		font-weight: 900;
		color: #ffffff;
		line-height: 1;
	}

	.increment-btn {
		width: 64px;
		height: 64px;
		background: #e91e8c;
		border: none;
		color: #ffffff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.increment-btn:hover {
		background: #f472b6;
		transform: scale(1.05);
	}

	.increment-btn:active {
		transform: scale(0.95);
	}

	.auto-rounds {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.rounds-text {
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 20px;
		font-weight: 700;
		color: #a3a3a3;
	}

	.phase-badge {
		padding: 8px 24px;
		font-family: 'Impact', 'Oswald', sans-serif;
		font-size: 24px;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.phase-badge.work {
		background: #e91e8c;
		color: #ffffff;
	}

	.phase-badge.rest {
		background: #6e489f;
		color: #ffffff;
	}
</style>
