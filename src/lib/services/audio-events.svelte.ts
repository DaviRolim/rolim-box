// src/lib/services/audio-events.svelte.ts
import type { AudioEvent, AudioCheckContext, TimerEventsConfig, EventTrigger, EventAction } from '$lib/types/audio';
import type { AudioConfig } from '$lib/types/audio';
import audioConfigJson from '$lib/config/audio-config.json';
import { audioService } from './audio.svelte';

const audioConfig = audioConfigJson as AudioConfig;

class AudioEventManager {
	private playedEvents = new Set<string>();
	private events: AudioEvent[] = [];
	private timerType: string = '';

	initialize(timerType: string): void {
		this.playedEvents.clear();
		this.timerType = timerType;
		this.events = this.resolveEvents(timerType);
	}

	reset(): void {
		this.playedEvents.clear();
	}

	check(ctx: AudioCheckContext): void {
		for (const event of this.events) {
			const eventId = this.getEventId(event, ctx);
			if (this.playedEvents.has(eventId)) continue;

			if (this.shouldTrigger(event.trigger, ctx)) {
				this.playedEvents.add(eventId);
				this.executeAction(event, ctx);
			}
		}
	}

	private resolveEvents(timerType: string): AudioEvent[] {
		const config = audioConfig.timerEvents[timerType];
		if (!config) return [];

		// If string, it's a reference to another timer type
		if (typeof config === 'string') {
			return this.resolveEvents(config);
		}

		return config;
	}

	private getEventId(event: AudioEvent, ctx: AudioCheckContext): string {
		const trigger = event.trigger;

		switch (trigger.type) {
			case 'percentage':
				return `percentage-${trigger.value}`;
			case 'remainingMs':
				return `remaining-${trigger.value}`;
			case 'roundStart':
				return `roundStart-${ctx.currentRound}`;
			case 'beforeRoundEnd':
				return `beforeRoundEnd-${trigger.seconds}-${ctx.currentRound}`;
			case 'phaseChange':
				return `phaseChange-${trigger.phase}-${ctx.currentRound}`;
			case 'halfwayRounds':
				return 'halfwayRounds';
			default:
				return `unknown-${JSON.stringify(trigger)}`;
		}
	}

	private shouldTrigger(trigger: EventTrigger, ctx: AudioCheckContext): boolean {
		switch (trigger.type) {
			case 'percentage': {
				const thresholdMs = (ctx.totalMs * trigger.value) / 100;
				return this.crossedThreshold(ctx.prevMs, ctx.currentMs, thresholdMs);
			}

			case 'remainingMs': {
				const thresholdMs = ctx.totalMs - trigger.value;
				return thresholdMs > 0 && this.crossedThreshold(ctx.prevMs, ctx.currentMs, thresholdMs);
			}

			case 'roundStart': {
				if (!ctx.roundChanged) return false;
				if (trigger.skipFirst && ctx.currentRound === 1) return false;
				return true;
			}

			case 'beforeRoundEnd': {
				const thresholdMs = ctx.roundDurationMs - trigger.seconds * 1000;
				if (thresholdMs <= 0) return false;

				const prevRoundElapsed = ctx.roundElapsedMs - (ctx.currentMs - ctx.prevMs);
				return this.crossedThreshold(prevRoundElapsed, ctx.roundElapsedMs, thresholdMs);
			}

			case 'phaseChange': {
				if (!ctx.phaseChanged) return false;
				const isTargetPhase = trigger.phase === 'work' ? ctx.isWorkPhase : !ctx.isWorkPhase;
				if (!isTargetPhase) return false;
				if (trigger.skipFirst && ctx.currentRound === 1 && trigger.phase === 'work') return false;
				return true;
			}

			case 'halfwayRounds': {
				if (ctx.totalRounds < 2) return false;
				const halfwayRound = Math.ceil(ctx.totalRounds / 2);
				return ctx.roundChanged && ctx.currentRound === halfwayRound + 1;
			}

			default:
				return false;
		}
	}

	private executeAction(event: AudioEvent, ctx: AudioCheckContext): void {
		const action = event.action;
		switch (action.type) {
			case 'voice':
				audioService.playVoiceCue(action.cue);
				break;

			case 'beep':
				audioService.playBeep(action.frequency, action.duration);
				break;

			case 'countdown': {
				let countdownValue: 3 | 2 | 1 | null = null;

				// For beforeRoundEnd triggers, use the seconds from trigger
				if (event.trigger.type === 'beforeRoundEnd') {
					const seconds = event.trigger.seconds;
					if (seconds === 3 || seconds === 2 || seconds === 1) {
						countdownValue = seconds;
					}
				} else {
					// For remainingMs triggers, calculate from total remaining
					const remainingMs = ctx.totalMs - ctx.currentMs;
					if (remainingMs <= 3000 && remainingMs > 2000) countdownValue = 3;
					else if (remainingMs <= 2000 && remainingMs > 1000) countdownValue = 2;
					else if (remainingMs <= 1000 && remainingMs > 0) countdownValue = 1;
				}

				if (countdownValue) {
					audioService.playCountdownBeep(countdownValue);
				}
				break;
			}
		}
	}

	private crossedThreshold(prevMs: number, currentMs: number, thresholdMs: number): boolean {
		return prevMs < thresholdMs && currentMs >= thresholdMs;
	}
}

export const audioEventManager = new AudioEventManager();
