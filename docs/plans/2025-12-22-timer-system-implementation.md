# Phase 3: Timer System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a complete timer system with four CrossFit timer types (AMRAP, EMOM, FOR TIME, TABATA), fullscreen display, and both standalone and WoD-attached modes.

**Architecture:** Svelte 5 runes-based state machine with a dedicated timer engine for precise timing. Timer configuration stored as JSON in `Section.timerConfig`. Fullscreen mode uses native Fullscreen API with Wake Lock to prevent screen sleep.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Zod validation, Fullscreen API, Wake Lock API

---

## Task 1: Timer Type Definitions

**Files:**
- Create: `src/lib/types/timer.ts`

**Step 1: Create timer type definitions**

```typescript
// src/lib/types/timer.ts
import { z } from 'zod';

// ============================================================================
// Type Definitions
// ============================================================================

export type TimerType = 'amrap' | 'emom' | 'fortime' | 'tabata';

export type TimerState = 'idle' | 'countdown' | 'running' | 'paused' | 'completed';

export const TIMER_TYPES = ['amrap', 'emom', 'fortime', 'tabata'] as const;

export interface TimerConfig {
	type: TimerType;
	duration?: number; // seconds - AMRAP total, FOR TIME cap
	rounds?: number; // EMOM & TABATA round count
	intervalWork?: number; // seconds - EMOM interval, TABATA work
	intervalRest?: number; // seconds - TABATA rest only
}

export interface TimerContext {
	sectionId?: string;
	sectionName?: string;
	wodId?: string;
}

// ============================================================================
// Default Configurations
// ============================================================================

export const TIMER_DEFAULTS: Record<TimerType, TimerConfig> = {
	amrap: { type: 'amrap', duration: 20 * 60 }, // 20 minutes
	emom: { type: 'emom', rounds: 10, intervalWork: 60 }, // 10 rounds x 60s
	fortime: { type: 'fortime', duration: 15 * 60 }, // 15 minute cap
	tabata: { type: 'tabata', rounds: 8, intervalWork: 20, intervalRest: 10 } // 8 rounds x 20s/10s
};

export const TIMER_LABELS: Record<TimerType, string> = {
	amrap: 'AMRAP',
	emom: 'EMOM',
	fortime: 'FOR TIME',
	tabata: 'TABATA'
};

export const TIMER_DESCRIPTIONS: Record<TimerType, string> = {
	amrap: 'As Many Rounds As Possible',
	emom: 'Every Minute On the Minute',
	fortime: 'Complete workout for time',
	tabata: 'Work/Rest intervals'
};

// ============================================================================
// Zod Validation Schemas
// ============================================================================

export const timerConfigSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('amrap'),
		duration: z.number().min(60).max(3600) // 1-60 minutes in seconds
	}),
	z.object({
		type: z.literal('emom'),
		rounds: z.number().min(1).max(50),
		intervalWork: z.number().min(10).max(300) // 10s-5min
	}),
	z.object({
		type: z.literal('fortime'),
		duration: z.number().min(60).max(3600) // 1-60 minutes cap in seconds
	}),
	z.object({
		type: z.literal('tabata'),
		rounds: z.number().min(1).max(20),
		intervalWork: z.number().min(5).max(60),
		intervalRest: z.number().min(5).max(60)
	})
]);

// ============================================================================
// Helper Functions
// ============================================================================

export function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimeMs(ms: number): string {
	return formatTime(Math.ceil(ms / 1000));
}

export function parseTimerConfig(json: string | null): TimerConfig | null {
	if (!json) return null;
	try {
		const parsed = JSON.parse(json);
		const result = timerConfigSchema.safeParse(parsed);
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}

export function serializeTimerConfig(config: TimerConfig): string {
	return JSON.stringify(config);
}

export function getTotalDuration(config: TimerConfig): number {
	switch (config.type) {
		case 'amrap':
		case 'fortime':
			return config.duration!;
		case 'emom':
			return config.rounds! * config.intervalWork!;
		case 'tabata':
			return config.rounds! * (config.intervalWork! + config.intervalRest!);
	}
}
```

**Step 2: Commit**

```bash
git add src/lib/types/timer.ts
git commit -m "feat(timer): add timer type definitions and validation"
```

---

## Task 2: Timer Engine

**Files:**
- Create: `src/lib/services/timer-engine.ts`

**Step 1: Create timer engine service**

```typescript
// src/lib/services/timer-engine.ts

export interface TimerEngineCallbacks {
	onTick: (deltaMs: number) => void;
	onComplete?: () => void;
}

export interface TimerEngine {
	start: () => void;
	pause: () => void;
	resume: () => void;
	stop: () => void;
	isRunning: () => boolean;
}

const TICK_INTERVAL = 100; // 100ms for smooth UI updates

export function createTimerEngine(callbacks: TimerEngineCallbacks): TimerEngine {
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let lastTickTime: number = 0;
	let running = false;

	function tick() {
		const now = performance.now();
		const delta = now - lastTickTime;
		lastTickTime = now;
		callbacks.onTick(delta);
	}

	function start() {
		if (running) return;
		running = true;
		lastTickTime = performance.now();
		intervalId = setInterval(tick, TICK_INTERVAL);
	}

	function pause() {
		if (!running) return;
		running = false;
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function resume() {
		if (running) return;
		running = true;
		lastTickTime = performance.now();
		intervalId = setInterval(tick, TICK_INTERVAL);
	}

	function stop() {
		running = false;
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function isRunning() {
		return running;
	}

	return { start, pause, resume, stop, isRunning };
}
```

**Step 2: Commit**

```bash
git add src/lib/services/timer-engine.ts
git commit -m "feat(timer): add timer engine with precise timing"
```

---

## Task 3: Timer Store (State Machine)

**Files:**
- Create: `src/lib/stores/timer.svelte.ts`

**Step 1: Create timer store with state machine**

```typescript
// src/lib/stores/timer.svelte.ts
import {
	type TimerConfig,
	type TimerState,
	type TimerContext,
	formatTimeMs,
	getTotalDuration
} from '$lib/types/timer';
import { createTimerEngine, type TimerEngine } from '$lib/services/timer-engine';

class TimerStore {
	// Core state
	config = $state<TimerConfig | null>(null);
	context = $state<TimerContext | null>(null);
	state = $state<TimerState>('idle');
	elapsedMs = $state(0);
	currentRound = $state(1);
	isWorkPhase = $state(true); // For TABATA
	completedRounds = $state(0); // Manual counter for AMRAP/FOR TIME
	countdownValue = $state<number | 'GO' | null>(null);

	// Internal
	private engine: TimerEngine | null = null;
	private totalDurationMs = 0;

	// Derived values
	get remainingMs(): number {
		if (!this.config) return 0;

		switch (this.config.type) {
			case 'amrap':
				return Math.max(0, this.totalDurationMs - this.elapsedMs);
			case 'fortime':
				return Math.max(0, this.totalDurationMs - this.elapsedMs);
			case 'emom': {
				const intervalMs = this.config.intervalWork! * 1000;
				const elapsedInRound = this.elapsedMs % intervalMs;
				return Math.max(0, intervalMs - elapsedInRound);
			}
			case 'tabata': {
				const workMs = this.config.intervalWork! * 1000;
				const restMs = this.config.intervalRest! * 1000;
				const cycleMs = workMs + restMs;
				const elapsedInCycle = this.elapsedMs % cycleMs;
				if (this.isWorkPhase) {
					return Math.max(0, workMs - elapsedInCycle);
				} else {
					return Math.max(0, cycleMs - elapsedInCycle);
				}
			}
		}
	}

	get displayTime(): string {
		if (!this.config) return '00:00';

		switch (this.config.type) {
			case 'amrap':
			case 'fortime':
				return formatTimeMs(
					this.config.type === 'fortime' ? this.elapsedMs : this.remainingMs
				);
			case 'emom':
			case 'tabata':
				return formatTimeMs(this.remainingMs);
		}
	}

	get progress(): number {
		if (!this.config || this.totalDurationMs === 0) return 0;
		return Math.min(1, this.elapsedMs / this.totalDurationMs);
	}

	get totalRounds(): number {
		if (!this.config) return 0;
		return this.config.rounds || 0;
	}

	// Actions
	initialize(config: TimerConfig, context?: TimerContext) {
		this.config = config;
		this.context = context || null;
		this.totalDurationMs = getTotalDuration(config) * 1000;
		this.reset();
	}

	async start() {
		if (this.state !== 'idle' || !this.config) return;

		// Run countdown sequence
		this.state = 'countdown';
		for (const val of [3, 2, 1, 'GO'] as const) {
			this.countdownValue = val;
			await this.sleep(val === 'GO' ? 500 : 1000);
		}
		this.countdownValue = null;

		// Start timer
		this.state = 'running';
		this.engine = createTimerEngine({
			onTick: (deltaMs) => this.handleTick(deltaMs)
		});
		this.engine.start();
	}

	pause() {
		if (this.state !== 'running') return;
		this.state = 'paused';
		this.engine?.pause();
	}

	resume() {
		if (this.state !== 'paused') return;
		this.state = 'running';
		this.engine?.resume();
	}

	stop() {
		this.engine?.stop();
		this.state = 'completed';
	}

	reset() {
		this.engine?.stop();
		this.engine = null;
		this.state = 'idle';
		this.elapsedMs = 0;
		this.currentRound = 1;
		this.isWorkPhase = true;
		this.completedRounds = 0;
		this.countdownValue = null;
	}

	incrementRounds() {
		this.completedRounds++;
	}

	// Private methods
	private handleTick(deltaMs: number) {
		if (!this.config) return;

		this.elapsedMs += deltaMs;

		// Check for completion
		if (this.elapsedMs >= this.totalDurationMs) {
			this.elapsedMs = this.totalDurationMs;
			this.stop();
			return;
		}

		// Handle round/phase transitions
		switch (this.config.type) {
			case 'emom': {
				const intervalMs = this.config.intervalWork! * 1000;
				const newRound = Math.floor(this.elapsedMs / intervalMs) + 1;
				if (newRound !== this.currentRound && newRound <= this.config.rounds!) {
					this.currentRound = newRound;
				}
				break;
			}
			case 'tabata': {
				const workMs = this.config.intervalWork! * 1000;
				const restMs = this.config.intervalRest! * 1000;
				const cycleMs = workMs + restMs;
				const newRound = Math.floor(this.elapsedMs / cycleMs) + 1;
				const elapsedInCycle = this.elapsedMs % cycleMs;
				const wasWorkPhase = this.isWorkPhase;
				this.isWorkPhase = elapsedInCycle < workMs;

				if (newRound !== this.currentRound && newRound <= this.config.rounds!) {
					this.currentRound = newRound;
				}
				break;
			}
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

export const timerStore = new TimerStore();
```

**Step 2: Commit**

```bash
git add src/lib/stores/timer.svelte.ts
git commit -m "feat(timer): add timer store with state machine"
```

---

## Task 4: Timer Config Component

**Files:**
- Create: `src/lib/components/timer/TimerConfig.svelte`

**Step 1: Create timer configuration form component**

```svelte
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
```

**Step 2: Commit**

```bash
git add src/lib/components/timer/TimerConfig.svelte
git commit -m "feat(timer): add timer configuration component"
```

---

## Task 5: Countdown Overlay Component

**Files:**
- Create: `src/lib/components/timer/CountdownOverlay.svelte`

**Step 1: Create countdown overlay component**

```svelte
<!-- src/lib/components/timer/CountdownOverlay.svelte -->
<script lang="ts">
	interface Props {
		value: number | 'GO' | null;
	}

	let { value }: Props = $props();
</script>

{#if value !== null}
	<div class="countdown-overlay">
		<div class="countdown-value" class:go={value === 'GO'}>
			{value}
		</div>
	</div>
{/if}

<style>
	.countdown-overlay {
		position: fixed;
		inset: 0;
		background: #0a0a0a;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.countdown-value {
		font-family: 'Impact', 'Oswald', 'Arial Narrow', sans-serif;
		font-size: clamp(120px, 30vw, 200px);
		font-weight: 900;
		color: #ffffff;
		text-transform: uppercase;
		animation: pulse 0.5s ease-out;
	}

	.countdown-value.go {
		color: #e91e8c;
		animation: goPulse 0.5s ease-out;
	}

	@keyframes pulse {
		0% {
			transform: scale(0.8);
			opacity: 0.5;
		}
		50% {
			transform: scale(1.1);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@keyframes goPulse {
		0% {
			transform: scale(0.5);
			opacity: 0;
		}
		50% {
			transform: scale(1.2);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.countdown-value {
			animation: none;
		}
	}
</style>
```

**Step 2: Commit**

```bash
git add src/lib/components/timer/CountdownOverlay.svelte
git commit -m "feat(timer): add countdown overlay component"
```

---

## Task 6: Timer Progress Component

**Files:**
- Create: `src/lib/components/timer/TimerProgress.svelte`

**Step 1: Create progress bar component**

```svelte
<!-- src/lib/components/timer/TimerProgress.svelte -->
<script lang="ts">
	interface Props {
		progress: number; // 0-1
	}

	let { progress }: Props = $props();
</script>

<div class="progress-container">
	<div class="progress-track">
		<div class="progress-fill" style="width: {progress * 100}%"></div>
	</div>
</div>

<style>
	.progress-container {
		width: 100%;
		padding: 0 24px;
	}

	.progress-track {
		width: 100%;
		height: 6px;
		background: #2a2a2a;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #6e489f 0%, #e91e8c 100%);
		transition: width 0.1s linear;
	}
</style>
```

**Step 2: Commit**

```bash
git add src/lib/components/timer/TimerProgress.svelte
git commit -m "feat(timer): add progress bar component"
```

---

## Task 7: Round Indicator Component

**Files:**
- Create: `src/lib/components/timer/RoundIndicator.svelte`

**Step 1: Create round indicator component**

```svelte
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
```

**Step 2: Commit**

```bash
git add src/lib/components/timer/RoundIndicator.svelte
git commit -m "feat(timer): add round indicator component"
```

---

## Task 8: Timer Controls Component

**Files:**
- Create: `src/lib/components/timer/TimerControls.svelte`

**Step 1: Create timer controls component**

```svelte
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

	const stopLabel = timerType === 'fortime' ? 'FINISH' : 'STOP';
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
```

**Step 2: Commit**

```bash
git add src/lib/components/timer/TimerControls.svelte
git commit -m "feat(timer): add timer controls component"
```

---

## Task 9: Timer Display Component

**Files:**
- Create: `src/lib/components/timer/TimerDisplay.svelte`

**Step 1: Create main timer display component**

```svelte
<!-- src/lib/components/timer/TimerDisplay.svelte -->
<script lang="ts">
	import { timerStore } from '$lib/stores/timer.svelte';
	import { TIMER_LABELS, formatTime } from '$lib/types/timer';
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
		<button type="button" class="exit-btn" onclick={handleExit} aria-label="Exit timer">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" stroke-linecap="square" />
			</svg>
		</button>
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

	.exit-btn {
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
```

**Step 2: Commit**

```bash
git add src/lib/components/timer/TimerDisplay.svelte
git commit -m "feat(timer): add main timer display component"
```

---

## Task 10: Timer Index Export

**Files:**
- Create: `src/lib/components/timer/index.ts`

**Step 1: Create barrel export**

```typescript
// src/lib/components/timer/index.ts
export { default as TimerConfig } from './TimerConfig.svelte';
export { default as TimerDisplay } from './TimerDisplay.svelte';
export { default as TimerControls } from './TimerControls.svelte';
export { default as TimerProgress } from './TimerProgress.svelte';
export { default as RoundIndicator } from './RoundIndicator.svelte';
export { default as CountdownOverlay } from './CountdownOverlay.svelte';
```

**Step 2: Commit**

```bash
git add src/lib/components/timer/index.ts
git commit -m "feat(timer): add component barrel exports"
```

---

## Task 11: Standalone Timer Config Page

**Files:**
- Create: `src/routes/(app)/timer/+page.svelte`

**Step 1: Create timer configuration route**

```svelte
<!-- src/routes/(app)/timer/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { timerStore } from '$lib/stores/timer.svelte';
	import { TimerConfig } from '$lib/components/timer';
	import { type TimerType, type TimerConfig as TConfig, TIMER_DEFAULTS } from '$lib/types/timer';

	// Get initial type from URL params
	const urlType = $page.url.searchParams.get('type') as TimerType | null;
	const initialType: TimerType = urlType && ['amrap', 'emom', 'fortime', 'tabata'].includes(urlType)
		? urlType
		: 'amrap';

	let configComponent: TimerConfig;

	function handleStart() {
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
		<TimerConfig bind:this={configComponent} initialType={initialType} />

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
```

**Step 2: Commit**

```bash
git add src/routes/\(app\)/timer/+page.svelte
git commit -m "feat(timer): add standalone timer config page"
```

---

## Task 12: Timer Execution Page

**Files:**
- Create: `src/routes/(app)/timer/[id]/+page.svelte`
- Create: `src/routes/(app)/timer/[id]/+page.ts`

**Step 1: Create page load function**

```typescript
// src/routes/(app)/timer/[id]/+page.ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	return {
		timerId: params.id
	};
};
```

**Step 2: Create timer execution page**

```svelte
<!-- src/routes/(app)/timer/[id]/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
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
```

**Step 3: Commit**

```bash
git add src/routes/\(app\)/timer/\[id\]/+page.svelte src/routes/\(app\)/timer/\[id\]/+page.ts
git commit -m "feat(timer): add timer execution page"
```

---

## Task 13: Dashboard Quick Actions Update

**Files:**
- Modify: `src/routes/(app)/dashboard/+page.svelte`

**Step 1: Add timer quick action buttons**

Find the quick actions section and add the timer buttons after the existing ones:

```svelte
<!-- Add after the existing quick-actions-grid in dashboard -->
<!-- Find this section: -->
<div class="quick-actions-grid">
	<!-- existing NEW WoD and ALL WORKOUTS buttons... -->
</div>

<!-- Replace with: -->
<div class="quick-actions-grid">
	<a href="/workouts/new" class="action-card action-new">
		<div class="action-icon">
			<div class="plus-icon">
				<div class="plus-h"></div>
				<div class="plus-v"></div>
			</div>
		</div>
		<span class="action-label">NEW WoD</span>
	</a>

	<a href="/workouts" class="action-card action-library">
		<div class="action-icon">
			<div class="library-icon">
				<div class="lib-line"></div>
				<div class="lib-line"></div>
				<div class="lib-line"></div>
			</div>
		</div>
		<span class="action-label">ALL WORKOUTS</span>
	</a>
</div>

<!-- Timer Quick Actions -->
<section class="section timer-section">
	<div class="section-header">
		<h2 class="section-title">QUICK TIMERS</h2>
		<div class="section-accent"></div>
	</div>

	<div class="timer-actions-grid">
		<a href="/timer?type=amrap" class="timer-card">
			<span class="timer-name">AMRAP</span>
			<span class="timer-desc">As Many Rounds As Possible</span>
		</a>
		<a href="/timer?type=emom" class="timer-card">
			<span class="timer-name">EMOM</span>
			<span class="timer-desc">Every Minute On the Minute</span>
		</a>
		<a href="/timer?type=fortime" class="timer-card">
			<span class="timer-name">FOR TIME</span>
			<span class="timer-desc">Complete for time</span>
		</a>
		<a href="/timer?type=tabata" class="timer-card">
			<span class="timer-name">TABATA</span>
			<span class="timer-desc">Work/Rest intervals</span>
		</a>
	</div>
</section>
```

**Step 2: Add timer card styles**

Add these styles to the dashboard:

```css
/* Timer Quick Actions */
.timer-section {
	margin-top: 0.5rem;
}

.timer-actions-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 12px;
}

.timer-card {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 16px;
	background: #1a1a1a;
	border: 2px solid #2a2a2a;
	border-left: 4px solid #e91e8c;
	text-decoration: none;
	transition: all 0.2s ease;
}

.timer-card:hover {
	border-color: #e91e8c;
	transform: translateX(4px);
	background: rgba(233, 30, 140, 0.05);
}

.timer-name {
	font-family: 'Impact', 'Oswald', 'Arial Narrow', sans-serif;
	font-size: 16px;
	font-weight: 900;
	letter-spacing: 0.05em;
	color: #ffffff;
}

.timer-desc {
	font-family: 'Inter', system-ui, sans-serif;
	font-size: 11px;
	font-weight: 500;
	color: #737373;
}

@media (max-width: 400px) {
	.timer-actions-grid {
		grid-template-columns: 1fr;
	}
}
```

**Step 3: Commit**

```bash
git add src/routes/\(app\)/dashboard/+page.svelte
git commit -m "feat(timer): add timer quick actions to dashboard"
```

---

## Task 14: Section Timer Config Integration

**Files:**
- Modify: `src/lib/components/sections/EditSectionForm.svelte`

**Step 1: Add timer configuration to section edit form**

Add imports at the top:

```svelte
<script lang="ts">
	import { sectionTypes } from '$lib/config/section-types';
	import type { Section, SectionType } from '$lib/types/wod';
	import { TimerConfig } from '$lib/components/timer';
	import { parseTimerConfig, serializeTimerConfig, type TimerConfig as TConfig } from '$lib/types/timer';

	interface Props {
		section: Section;
		onSave: (updates: { type: SectionType; name: string; content: string; timerConfig: string | null }) => void;
		onCancel: () => void;
	}

	let { section, onSave, onCancel }: Props = $props();

	// ... existing state ...
	let showTimerConfig = $state(!!section.timerConfig);
	let timerConfigComponent: TimerConfig;
	let initialTimerConfig = $state(parseTimerConfig(section.timerConfig));

	// ... existing functions ...

	function handleSubmit() {
		if (!validateForm()) return;

		let timerConfig: string | null = null;
		if (showTimerConfig && timerConfigComponent) {
			timerConfig = serializeTimerConfig(timerConfigComponent.getConfig());
		}

		onSave({
			type: selectedType,
			name: name.trim(),
			content: content.trim(),
			timerConfig
		});
	}

	function toggleTimerConfig() {
		showTimerConfig = !showTimerConfig;
	}

	function removeTimerConfig() {
		showTimerConfig = false;
		initialTimerConfig = null;
	}
</script>
```

Add timer config UI after the content textarea:

```svelte
<!-- After the content form-group, add: -->
<div class="form-group">
	{#if !showTimerConfig}
		<button type="button" class="btn-add-timer" onclick={toggleTimerConfig}>
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
				<circle cx="8" cy="8" r="6" stroke-width="1.5" />
				<path d="M8 5V8L10.5 10.5" stroke-width="1.5" stroke-linecap="square" />
			</svg>
			Add Timer
		</button>
	{:else}
		<div class="timer-config-container">
			<div class="timer-config-header">
				<span class="timer-config-label">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
						<circle cx="8" cy="8" r="6" stroke-width="1.5" />
						<path d="M8 5V8L10.5 10.5" stroke-width="1.5" stroke-linecap="square" />
					</svg>
					Timer
				</span>
				<button type="button" class="btn-remove-timer" onclick={removeTimerConfig}>
					Remove
				</button>
			</div>
			<TimerConfig
				bind:this={timerConfigComponent}
				initialConfig={initialTimerConfig}
				compact={true}
			/>
		</div>
	{/if}
</div>
```

Add styles:

```css
.btn-add-timer {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	padding: 14px 16px;
	background: transparent;
	border: 2px dashed #2a2a2a;
	color: #525252;
	font-family: 'Inter', system-ui, sans-serif;
	font-size: 13px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.15s ease;
}

.btn-add-timer:hover {
	border-color: #e91e8c;
	color: #e91e8c;
	background: rgba(233, 30, 140, 0.05);
}

.timer-config-container {
	background: #0a0a0a;
	border: 2px solid #2a2a2a;
	padding: 16px;
}

.timer-config-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16px;
	padding-bottom: 12px;
	border-bottom: 1px solid #2a2a2a;
}

.timer-config-label {
	display: flex;
	align-items: center;
	gap: 8px;
	font-family: 'Inter', system-ui, sans-serif;
	font-size: 13px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: #e91e8c;
}

.btn-remove-timer {
	padding: 6px 12px;
	background: transparent;
	border: 1px solid #ef4444;
	color: #ef4444;
	font-family: 'Inter', system-ui, sans-serif;
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	cursor: pointer;
	transition: all 0.15s ease;
}

.btn-remove-timer:hover {
	background: #ef4444;
	color: #ffffff;
}
```

**Step 2: Commit**

```bash
git add src/lib/components/sections/EditSectionForm.svelte
git commit -m "feat(timer): add timer config to section edit form"
```

---

## Task 15: Section Card Timer Badge

**Files:**
- Modify: `src/lib/components/sections/SectionCard.svelte`

**Step 1: Update section card to show timer badge and launch button**

Add imports:

```svelte
<script lang="ts">
	import { sectionTypes } from '$lib/config/section-types';
	import type { Section } from '$lib/types/wod';
	import { parseTimerConfig, TIMER_LABELS, formatTime } from '$lib/types/timer';

	// ... existing props ...

	const timerConfig = $derived(parseTimerConfig(section.timerConfig));
</script>
```

Replace the `.section-footer` with:

```svelte
<div class="section-footer">
	{#if timerConfig}
		<a
			href="/timer/{section.id}?wod={section.wodId}"
			class="btn-timer-active"
		>
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
				<circle cx="8" cy="8" r="6" stroke-width="1.5" />
				<path d="M8 5V8L10.5 10.5" stroke-width="1.5" stroke-linecap="square" />
			</svg>
			{TIMER_LABELS[timerConfig.type]}
			{#if timerConfig.type === 'amrap' || timerConfig.type === 'fortime'}
				- {formatTime(timerConfig.duration!)}
			{:else if timerConfig.type === 'emom'}
				- {timerConfig.rounds}x{timerConfig.intervalWork}s
			{:else if timerConfig.type === 'tabata'}
				- {timerConfig.rounds}x {timerConfig.intervalWork}s/{timerConfig.intervalRest}s
			{/if}
		</a>
	{:else}
		<button type="button" class="btn-timer" disabled title="No timer configured">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
				<circle cx="8" cy="8" r="6" stroke-width="1.5" />
				<path d="M8 5V8L10.5 10.5" stroke-width="1.5" stroke-linecap="square" />
			</svg>
			No Timer
		</button>
	{/if}
</div>
```

Add/update styles:

```css
.btn-timer-active {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 12px 20px;
	background: linear-gradient(135deg, #e91e8c 0%, #be185d 100%);
	border: 2px solid #e91e8c;
	color: #ffffff;
	font-family: 'Inter', system-ui, sans-serif;
	font-size: 13px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	text-decoration: none;
	cursor: pointer;
	transition: all 0.2s ease;
	min-height: 48px;
}

.btn-timer-active:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(233, 30, 140, 0.4);
}
```

**Step 2: Commit**

```bash
git add src/lib/components/sections/SectionCard.svelte
git commit -m "feat(timer): add timer badge to section card"
```

---

## Task 16: WoD View Timer Integration

**Files:**
- Modify: `src/routes/(app)/workouts/[id]/+page.svelte`

**Step 1: Update WoD view to show active timer buttons**

Add imports:

```svelte
<script lang="ts">
	// ... existing imports ...
	import { parseTimerConfig, TIMER_LABELS, formatTime } from '$lib/types/timer';
</script>
```

Replace the timer button in the section footer:

```svelte
<!-- Replace the disabled btn-timer with: -->
<div class="section-footer">
	{@const timerConfig = parseTimerConfig(section.timerConfig)}
	{#if timerConfig}
		<a
			href="/timer/{section.id}?wod={wod.id}"
			class="btn-timer-active"
		>
			<svg class="timer-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
				<circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" />
				<path d="M10 6v4l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="square" />
			</svg>
			<span class="timer-text">{TIMER_LABELS[timerConfig.type]}</span>
			<span class="timer-config-text">
				{#if timerConfig.type === 'amrap' || timerConfig.type === 'fortime'}
					{formatTime(timerConfig.duration!)}
				{:else if timerConfig.type === 'emom'}
					{timerConfig.rounds}x{timerConfig.intervalWork}s
				{:else if timerConfig.type === 'tabata'}
					{timerConfig.rounds}x {timerConfig.intervalWork}s/{timerConfig.intervalRest}s
				{/if}
			</span>
		</a>
	{:else}
		<span class="no-timer-text">No timer configured</span>
	{/if}
</div>
```

Add styles:

```css
.btn-timer-active {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 12px 20px;
	background: linear-gradient(135deg, #e91e8c 0%, #be185d 100%);
	border: 2px solid #e91e8c;
	color: #ffffff;
	font-family: 'Inter', system-ui, sans-serif;
	font-size: 12px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	text-decoration: none;
	cursor: pointer;
	transition: all 0.2s ease;
	min-height: 44px;
}

.btn-timer-active:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(233, 30, 140, 0.4);
}

.timer-config-text {
	padding: 4px 8px;
	background: rgba(0, 0, 0, 0.3);
	font-size: 11px;
}

.no-timer-text {
	font-family: 'Inter', system-ui, sans-serif;
	font-size: 12px;
	color: #525252;
}
```

**Step 2: Commit**

```bash
git add src/routes/\(app\)/workouts/\[id\]/+page.svelte
git commit -m "feat(timer): add timer launch buttons to WoD view"
```

---

## Task 17: Update Section Type to Include Timer Config

**Files:**
- Modify: `src/lib/services/wod.ts`

**Step 1: Ensure timer config is included in section updates**

Check that the WoD service handles `timerConfig` in section updates. The field should already be part of the Section interface. Verify that updates preserve the `timerConfig` field.

Look for the update function and ensure it includes timerConfig in the section data.

**Step 2: Commit (if changes needed)**

```bash
git add src/lib/services/wod.ts
git commit -m "feat(timer): ensure timerConfig preserved in section updates"
```

---

## Task 18: Final Testing & Cleanup

**Step 1: Create timer directory if needed**

```bash
mkdir -p src/routes/\(app\)/timer/\[id\]
```

**Step 2: Verify all components compile**

```bash
bun run build
```

**Step 3: Test the timer flow**

1. Navigate to Dashboard
2. Click a timer quick action (AMRAP, EMOM, etc.)
3. Configure the timer
4. Start the timer
5. Verify countdown, display, controls
6. Test pause/resume/reset/stop

**Step 4: Test section timer integration**

1. Create/edit a WoD
2. Add a section
3. Add a timer to the section
4. Save the WoD
5. View the WoD
6. Launch timer from section
7. Verify timer loads with correct config

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(timer): complete Phase 3 timer system implementation"
```

---

## Implementation Summary

**Files Created (11):**
- `src/lib/types/timer.ts`
- `src/lib/services/timer-engine.ts`
- `src/lib/stores/timer.svelte.ts`
- `src/lib/components/timer/TimerConfig.svelte`
- `src/lib/components/timer/CountdownOverlay.svelte`
- `src/lib/components/timer/TimerProgress.svelte`
- `src/lib/components/timer/RoundIndicator.svelte`
- `src/lib/components/timer/TimerControls.svelte`
- `src/lib/components/timer/TimerDisplay.svelte`
- `src/lib/components/timer/index.ts`
- `src/routes/(app)/timer/+page.svelte`
- `src/routes/(app)/timer/[id]/+page.svelte`
- `src/routes/(app)/timer/[id]/+page.ts`

**Files Modified (4):**
- `src/routes/(app)/dashboard/+page.svelte`
- `src/lib/components/sections/EditSectionForm.svelte`
- `src/lib/components/sections/SectionCard.svelte`
- `src/routes/(app)/workouts/[id]/+page.svelte`

**Total Commits: 17**
