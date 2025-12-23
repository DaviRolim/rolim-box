<!-- src/lib/components/timer/TimerConfig.svelte -->
<script lang="ts">
	import {
		type TimerType,
		type TimerConfig,
		TIMER_TYPES,
		TIMER_LABELS,
		TIMER_DEFAULTS
	} from '$lib/types/timer';

	interface Props {
		initialConfig?: TimerConfig | null;
		initialType?: TimerType;
		compact?: boolean;
		onConfigChange?: (config: TimerConfig) => void;
	}

	let { initialConfig = null, initialType = 'amrap', compact = false, onConfigChange }: Props = $props();

	let selectedType = $state<TimerType>(initialConfig?.type || initialType);
	let duration = $state(initialConfig?.duration ? initialConfig.duration / 60 : 20);
	let rounds = $state(initialConfig?.rounds || 10);
	let intervalWork = $state(initialConfig?.intervalWork || 60);
	let intervalRest = $state(initialConfig?.intervalRest || 10);

	// Reset to defaults when type changes
	function handleTypeChange(type: TimerType) {
		selectedType = type;
		const defaults = TIMER_DEFAULTS[type];
		duration = defaults.duration ? defaults.duration / 60 : 20;
		rounds = defaults.rounds || 10;
		intervalWork = defaults.intervalWork || 60;
		intervalRest = defaults.intervalRest || 10;
		emitConfig();
	}

	function emitConfig() {
		if (!onConfigChange) return;
		onConfigChange(buildConfig());
	}

	export function buildConfig(): TimerConfig {
		switch (selectedType) {
			case 'amrap':
				return { type: 'amrap', duration: duration * 60 };
			case 'emom':
				return { type: 'emom', rounds, intervalWork };
			case 'fortime':
				return { type: 'fortime', duration: duration * 60 };
			case 'tabata':
				return { type: 'tabata', rounds, intervalWork, intervalRest };
		}
	}

	export function getConfig(): TimerConfig {
		return buildConfig();
	}
</script>

<div class="timer-config" class:compact>
	<!-- Type selector -->
	<div class="type-selector">
		{#each TIMER_TYPES as type}
			<button
				type="button"
				class="type-btn"
				class:active={selectedType === type}
				onclick={() => handleTypeChange(type)}
			>
				{TIMER_LABELS[type]}
			</button>
		{/each}
	</div>

	<!-- Config fields based on type -->
	<div class="config-fields">
		{#if selectedType === 'amrap' || selectedType === 'fortime'}
			<div class="field">
				<label class="field-label" for="duration">
					{selectedType === 'fortime' ? 'Time Cap' : 'Duration'}
				</label>
				<div class="field-input-group">
					<button type="button" class="stepper-btn" onclick={() => { duration = Math.max(1, duration - 1); emitConfig(); }}>-</button>
					<input
						id="duration"
						type="number"
						class="field-input"
						bind:value={duration}
						onchange={emitConfig}
						min="1"
						max="60"
					/>
					<button type="button" class="stepper-btn" onclick={() => { duration = Math.min(60, duration + 1); emitConfig(); }}>+</button>
				</div>
				<span class="field-unit">minutes</span>
			</div>
		{/if}

		{#if selectedType === 'emom'}
			<div class="field">
				<label class="field-label" for="rounds">Rounds</label>
				<div class="field-input-group">
					<button type="button" class="stepper-btn" onclick={() => { rounds = Math.max(1, rounds - 1); emitConfig(); }}>-</button>
					<input
						id="rounds"
						type="number"
						class="field-input"
						bind:value={rounds}
						onchange={emitConfig}
						min="1"
						max="50"
					/>
					<button type="button" class="stepper-btn" onclick={() => { rounds = Math.min(50, rounds + 1); emitConfig(); }}>+</button>
				</div>
			</div>
			<div class="field">
				<label class="field-label" for="interval">Interval</label>
				<div class="field-input-group">
					<button type="button" class="stepper-btn" onclick={() => { intervalWork = Math.max(10, intervalWork - 5); emitConfig(); }}>-</button>
					<input
						id="interval"
						type="number"
						class="field-input"
						bind:value={intervalWork}
						onchange={emitConfig}
						min="10"
						max="300"
					/>
					<button type="button" class="stepper-btn" onclick={() => { intervalWork = Math.min(300, intervalWork + 5); emitConfig(); }}>+</button>
				</div>
				<span class="field-unit">seconds</span>
			</div>
		{/if}

		{#if selectedType === 'tabata'}
			<div class="field">
				<label class="field-label" for="tabata-rounds">Rounds</label>
				<div class="field-input-group">
					<button type="button" class="stepper-btn" onclick={() => { rounds = Math.max(1, rounds - 1); emitConfig(); }}>-</button>
					<input
						id="tabata-rounds"
						type="number"
						class="field-input"
						bind:value={rounds}
						onchange={emitConfig}
						min="1"
						max="20"
					/>
					<button type="button" class="stepper-btn" onclick={() => { rounds = Math.min(20, rounds + 1); emitConfig(); }}>+</button>
				</div>
			</div>
			<div class="field">
				<label class="field-label" for="work">Work</label>
				<div class="field-input-group">
					<button type="button" class="stepper-btn" onclick={() => { intervalWork = Math.max(5, intervalWork - 5); emitConfig(); }}>-</button>
					<input
						id="work"
						type="number"
						class="field-input"
						bind:value={intervalWork}
						onchange={emitConfig}
						min="5"
						max="60"
					/>
					<button type="button" class="stepper-btn" onclick={() => { intervalWork = Math.min(60, intervalWork + 5); emitConfig(); }}>+</button>
				</div>
				<span class="field-unit">seconds</span>
			</div>
			<div class="field">
				<label class="field-label" for="rest">Rest</label>
				<div class="field-input-group">
					<button type="button" class="stepper-btn" onclick={() => { intervalRest = Math.max(5, intervalRest - 5); emitConfig(); }}>-</button>
					<input
						id="rest"
						type="number"
						class="field-input"
						bind:value={intervalRest}
						onchange={emitConfig}
						min="5"
						max="60"
					/>
					<button type="button" class="stepper-btn" onclick={() => { intervalRest = Math.min(60, intervalRest + 5); emitConfig(); }}>+</button>
				</div>
				<span class="field-unit">seconds</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.timer-config {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.timer-config.compact {
		gap: 16px;
	}

	.type-selector {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
	}

	.compact .type-selector {
		grid-template-columns: repeat(2, 1fr);
	}

	.type-btn {
		padding: 12px 8px;
		background: transparent;
		border: 2px solid #2a2a2a;
		color: #737373;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.15s ease;
		min-height: 44px;
	}

	.type-btn:hover {
		border-color: #3a3a3a;
		color: #a3a3a3;
	}

	.type-btn.active {
		border-color: #e91e8c;
		color: #e91e8c;
		background: rgba(233, 30, 140, 0.1);
	}

	.config-fields {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.field-label {
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #ffffff;
	}

	.field-input-group {
		display: flex;
		align-items: center;
		gap: 0;
	}

	.stepper-btn {
		width: 48px;
		height: 48px;
		background: #1a1a1a;
		border: 2px solid #2a2a2a;
		color: #ffffff;
		font-size: 20px;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.stepper-btn:first-child {
		border-right: none;
	}

	.stepper-btn:last-child {
		border-left: none;
	}

	.stepper-btn:hover {
		background: #2a2a2a;
		color: #e91e8c;
	}

	.field-input {
		flex: 1;
		height: 48px;
		padding: 0 16px;
		background: #0a0a0a;
		border: 2px solid #2a2a2a;
		color: #ffffff;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 18px;
		font-weight: 700;
		text-align: center;
	}

	.field-input:focus {
		outline: none;
		border-color: #6e489f;
	}

	/* Hide number input spinners */
	.field-input::-webkit-outer-spin-button,
	.field-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.field-input[type='number'] {
		-moz-appearance: textfield;
	}

	.field-unit {
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 12px;
		font-weight: 600;
		color: #525252;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
</style>
