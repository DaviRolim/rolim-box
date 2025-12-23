// src/lib/stores/timer.svelte.ts
import {
	type TimerConfig,
	type TimerState,
	type TimerContext,
	formatTimeMs,
	getTotalDuration
} from '$lib/types/timer';
import { createTimerEngine, type TimerEngine } from '$lib/services/timer-engine';
import { audioService } from '$lib/services/audio.svelte';
import { audioEventManager } from '$lib/services/audio-events.svelte';

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
		audioEventManager.initialize(config.type);
	}

	async start() {
		if (this.state !== 'idle' || !this.config) return;

		// Run countdown sequence with audio
		this.state = 'countdown';
		for (const val of [3, 2, 1, 'GO'] as const) {
			this.countdownValue = val;
			if (val === 'GO') {
				audioService.playVoiceCue('go');
				await this.sleep(500);
			} else {
				audioService.playCountdownBeep(val);
				await this.sleep(1000);
			}
		}
		this.countdownValue = null;

		// Start timer (event-based audio - no pre-scheduling)
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
		// No audio cancellation needed - we're event-based now
	}

	resume() {
		if (this.state !== 'paused' || !this.config) return;
		this.state = 'running';
		this.engine?.resume();
		// No audio rescheduling needed - we're event-based now
	}

	stop() {
		this.engine?.stop();
		this.state = 'completed';
		// Play completion sound
		audioService.playVoiceCue('time');
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
		audioEventManager.reset();
	}

	incrementRounds() {
		this.completedRounds++;
	}

	// Private methods
	private getRoundElapsedMs(): number {
		if (!this.config) return 0;

		switch (this.config.type) {
			case 'emom': {
				const intervalMs = this.config.intervalWork! * 1000;
				return this.elapsedMs % intervalMs;
			}
			case 'tabata': {
				const workMs = this.config.intervalWork! * 1000;
				const restMs = this.config.intervalRest! * 1000;
				const cycleMs = workMs + restMs;
				return this.elapsedMs % cycleMs;
			}
			default:
				return this.elapsedMs;
		}
	}

	private getRoundDurationMs(): number {
		if (!this.config) return 0;

		switch (this.config.type) {
			case 'emom':
				return this.config.intervalWork! * 1000;
			case 'tabata':
				return this.isWorkPhase
					? this.config.intervalWork! * 1000
					: this.config.intervalRest! * 1000;
			default:
				return this.totalDurationMs;
		}
	}

	private handleTick(deltaMs: number) {
		if (!this.config) return;

		const prevElapsedMs = this.elapsedMs;
		const prevRound = this.currentRound;
		const prevPhase = this.isWorkPhase;

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
				this.isWorkPhase = elapsedInCycle < workMs;

				if (newRound !== this.currentRound && newRound <= this.config.rounds!) {
					this.currentRound = newRound;
				}
				break;
			}
		}

		// Check audio events via event manager
		audioEventManager.check({
			prevMs: prevElapsedMs,
			currentMs: this.elapsedMs,
			totalMs: this.totalDurationMs,
			currentRound: this.currentRound,
			totalRounds: this.totalRounds,
			roundChanged: this.currentRound !== prevRound,
			isWorkPhase: this.isWorkPhase,
			phaseChanged: this.isWorkPhase !== prevPhase,
			roundElapsedMs: this.getRoundElapsedMs(),
			roundDurationMs: this.getRoundDurationMs()
		});
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

export const timerStore = new TimerStore();
