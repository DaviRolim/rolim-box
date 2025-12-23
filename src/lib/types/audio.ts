// src/lib/types/audio.ts

// ============================================================================
// Audio Cue Types
// ============================================================================

export type VoiceCueType =
	| 'go'
	| 'halfway'
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
		checkpoints: CheckpointConfig[];
		completion: VoiceConfig;
	};
	emom: {
		roundTransition: VoiceConfig;
		roundWarning: BeepConfig & { remainingMs: number };
	};
	tabata: {
		workPhase: VoiceConfig;
		restPhase: VoiceConfig;
	};
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
