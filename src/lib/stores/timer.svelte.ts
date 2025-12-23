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
	private playedEvents = new Set<string>(); // Track played audio events

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
	}

	async start() {
		if (this.state !== 'idle' || !this.config) return;

		// Reset played events for fresh start
		this.playedEvents.clear();

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
		this.playedEvents.clear();
	}

	incrementRounds() {
		this.completedRounds++;
	}

	// Private methods
	private handleTick(deltaMs: number) {
		if (!this.config) return;

		const prevElapsedMs = this.elapsedMs;
		this.elapsedMs += deltaMs;

		// Check for completion
		if (this.elapsedMs >= this.totalDurationMs) {
			this.elapsedMs = this.totalDurationMs;
			this.stop();
			return;
		}

		// Check audio events BEFORE updating rounds (to detect transitions)
		this.checkAudioEvents(prevElapsedMs, this.elapsedMs);

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
	}

	// Event-based audio checking
	private checkAudioEvents(prevMs: number, currentMs: number) {
		if (!this.config) return;

		switch (this.config.type) {
			case 'emom':
				this.checkEmomAudio(prevMs, currentMs);
				break;
			case 'amrap':
			case 'fortime':
				this.checkAmrapForTimeAudio(prevMs, currentMs);
				break;
			case 'tabata':
				this.checkTabataAudio(prevMs, currentMs);
				break;
		}
	}

	private checkEmomAudio(prevMs: number, currentMs: number) {
		if (!this.config || this.config.type !== 'emom') return;

		const intervalMs = this.config.intervalWork! * 1000;
		const totalRounds = this.config.rounds!;
		const totalMs = this.totalDurationMs;

		// Calculate halfway round (used to skip "next round" at halfway point)
		const halfwayRound = Math.ceil(totalRounds / 2);
		const hasHalfway = halfwayRound >= 1 && halfwayRound < totalRounds;

		// Check each round transition (except first)
		for (let round = 2; round <= totalRounds; round++) {
			const transitionMs = (round - 1) * intervalMs;

			// 10-second warning beep before transition
			const warningMs = transitionMs - 10000;
			if (warningMs > 0 && this.crossedThreshold(prevMs, currentMs, warningMs)) {
				this.playOnce(`emom-warning-${round}`, () => {
					audioService.playBeep(880, 100);
				});
			}

			// 3, 2, 1 countdown beeps before transition
			for (const sec of [3, 2, 1] as const) {
				const countdownMs = transitionMs - sec * 1000;
				if (countdownMs > 0 && this.crossedThreshold(prevMs, currentMs, countdownMs)) {
					this.playOnce(`emom-countdown-${round}-${sec}`, () => {
						audioService.playCountdownBeep(sec);
					});
				}
			}

			// Round transition voice cue (skip if this is the halfway point)
			const isHalfwayTransition = hasHalfway && round - 1 === halfwayRound;
			if (!isHalfwayTransition && this.crossedThreshold(prevMs, currentMs, transitionMs)) {
				this.playOnce(`emom-transition-${round}`, () => {
					audioService.playVoiceCue('next-round');
				});
			}
		}

		// Final countdown before timer ends (last round completion)
		// 10-second warning beep before end
		const finalWarningMs = totalMs - 10000;
		if (finalWarningMs > 0 && this.crossedThreshold(prevMs, currentMs, finalWarningMs)) {
			this.playOnce('emom-warning-final', () => {
				audioService.playBeep(880, 100);
			});
		}

		// 3, 2, 1 countdown before timer ends
		for (const sec of [3, 2, 1] as const) {
			const countdownMs = totalMs - sec * 1000;
			if (countdownMs > 0 && this.crossedThreshold(prevMs, currentMs, countdownMs)) {
				this.playOnce(`emom-countdown-final-${sec}`, () => {
					audioService.playCountdownBeep(sec);
				});
			}
		}

		// Halfway through all rounds (plays after the middle round)
		if (hasHalfway) {
			const halfwayMs = halfwayRound * intervalMs;
			if (this.crossedThreshold(prevMs, currentMs, halfwayMs)) {
				this.playOnce('emom-halfway-rounds', () => {
					audioService.playVoiceCue('half-emom');
				});
			}
		}
	}

	private checkAmrapForTimeAudio(prevMs: number, currentMs: number) {
		if (!this.config) return;

		const totalMs = this.totalDurationMs;

		// Halfway through time
		const halfwayMs = totalMs / 2;
		if (this.crossedThreshold(prevMs, currentMs, halfwayMs)) {
			this.playOnce('halfway', () => {
				audioService.playVoiceCue('halfway');
			});
		}

		// One minute remaining
		const oneMinuteMs = totalMs - 60000;
		if (oneMinuteMs > 0 && this.crossedThreshold(prevMs, currentMs, oneMinuteMs)) {
			this.playOnce('one-minute', () => {
				audioService.playVoiceCue('one-minute');
			});
		}

		// 10 seconds remaining
		const tenSecondsMs = totalMs - 10000;
		if (tenSecondsMs > 0 && this.crossedThreshold(prevMs, currentMs, tenSecondsMs)) {
			this.playOnce('ten-seconds', () => {
				audioService.playVoiceCue('ten-seconds');
			});
		}

		// 3, 2, 1 countdown
		for (const sec of [3, 2, 1] as const) {
			const countdownMs = totalMs - sec * 1000;
			if (countdownMs > 0 && this.crossedThreshold(prevMs, currentMs, countdownMs)) {
				this.playOnce(`countdown-${sec}`, () => {
					audioService.playCountdownBeep(sec);
				});
			}
		}
	}

	private checkTabataAudio(prevMs: number, currentMs: number) {
		if (!this.config || this.config.type !== 'tabata') return;

		const workMs = this.config.intervalWork! * 1000;
		const restMs = this.config.intervalRest! * 1000;
		const cycleMs = workMs + restMs;
		const totalRounds = this.config.rounds!;

		for (let round = 1; round <= totalRounds; round++) {
			const cycleStart = (round - 1) * cycleMs;

			// Work phase at cycle start (skip first - that's the GO)
			if (round > 1 && this.crossedThreshold(prevMs, currentMs, cycleStart)) {
				this.playOnce(`tabata-work-${round}`, () => {
					audioService.playVoiceCue('work');
				});
			}

			// Rest phase after work
			const restStart = cycleStart + workMs;
			if (this.crossedThreshold(prevMs, currentMs, restStart)) {
				this.playOnce(`tabata-rest-${round}`, () => {
					audioService.playVoiceCue('rest');
				});
			}
		}
	}

	// Helper: Check if we crossed a threshold between prev and current
	private crossedThreshold(prevMs: number, currentMs: number, thresholdMs: number): boolean {
		return prevMs < thresholdMs && currentMs >= thresholdMs;
	}

	// Helper: Play audio only once per event ID
	private playOnce(eventId: string, playFn: () => void) {
		if (this.playedEvents.has(eventId)) return;
		this.playedEvents.add(eventId);
		playFn();
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

export const timerStore = new TimerStore();
