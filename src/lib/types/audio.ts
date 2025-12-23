// src/lib/types/audio.ts

// ============================================================================
// Audio Cue Types
// ============================================================================

export type VoiceCueType =
	| 'go'
	| 'halfway'
	| 'half-emom'
	| 'one-minute'
	| 'thirty-seconds'
	| 'ten-seconds'
	| 'time'
	| 'next-round'
	| 'work'
	| 'rest';

export type CountdownValue = 3 | 2 | 1;

// ============================================================================
// Configuration Types
// ============================================================================

export interface BeepConfig {
	type: 'beep';
	frequency: number; // Hz
	duration: number; // ms
}

export interface VoiceConfig {
	type: 'voice';
	file: string;
}

export type AudioCueConfig = BeepConfig | VoiceConfig;

export interface CheckpointConfig {
	id: string;
	remainingMs?: number; // For time-based checkpoints (not halfway)
	type: 'beep' | 'voice';
	file?: string;
	frequency?: number;
	duration?: number;
}

export interface AudioConfig {
	universal: {
		countdown: {
			'3': BeepConfig;
			'2': BeepConfig;
			'1': BeepConfig;
			go: VoiceConfig;
		};
		completion: VoiceConfig;
	};
	timerEvents: Record<string, TimerEventsConfig>;
}

// ============================================================================
// Scheduled Audio Types
// ============================================================================

export interface ScheduledCheckpoint {
	triggerMs: number; // ms from timer start when this should play
	type: 'beep' | 'voice';
	file?: string;
	frequency?: number;
	duration?: number;
}

// ============================================================================
// Event System Types
// ============================================================================

export type EventTrigger =
	| { type: 'percentage'; value: number }
	| { type: 'remainingMs'; value: number }
	| { type: 'roundStart'; skipFirst?: boolean }
	| { type: 'beforeRoundEnd'; seconds: number }
	| { type: 'phaseChange'; phase: 'work' | 'rest'; skipFirst?: boolean }
	| { type: 'halfwayRounds' };

export type EventAction =
	| { type: 'voice'; cue: VoiceCueType }
	| { type: 'beep'; frequency: number; duration: number }
	| { type: 'countdown' };

export interface AudioEvent {
	trigger: EventTrigger;
	action: EventAction;
}

export interface AudioCheckContext {
	prevMs: number;
	currentMs: number;
	totalMs: number;
	currentRound: number;
	totalRounds: number;
	roundChanged: boolean;
	isWorkPhase: boolean;
	phaseChanged: boolean;
	roundElapsedMs: number;
	roundDurationMs: number;
}

export type TimerEventsConfig = AudioEvent[] | string;
