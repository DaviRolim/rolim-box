// src/lib/services/audio.ts
import type { AudioConfig, ScheduledCheckpoint, CountdownValue, VoiceCueType } from '$lib/types/audio';
import type { TimerConfig } from '$lib/types/timer';
import { getTotalDuration } from '$lib/types/timer';
import audioConfigJson from '$lib/config/audio-config.json';

const audioConfig = audioConfigJson as AudioConfig;

// ============================================================================
// Audio Context Management
// ============================================================================

let audioContext: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
let scheduledNodes: (AudioBufferSourceNode | OscillatorNode)[] = [];
let preloaded = false;

function getAudioContext(): AudioContext {
	if (!audioContext) {
		audioContext = new AudioContext();
	}
	return audioContext;
}

async function ensureContextResumed(): Promise<void> {
	const ctx = getAudioContext();
	if (ctx.state === 'suspended') {
		await ctx.resume();
	}
}

// ============================================================================
// Preloading
// ============================================================================

const VOICE_FILES: VoiceCueType[] = [
	'go',
	'halfway',
	'one-minute',
	'thirty-seconds',
	'ten-seconds',
	'time',
	'next-round',
	'work',
	'rest'
];

async function loadAudioBuffer(filename: string): Promise<AudioBuffer | null> {
	try {
		const ctx = getAudioContext();
		const response = await fetch(`/audio/voice/${filename}`);
		if (!response.ok) {
			console.warn(`Audio file not found: ${filename}`);
			return null;
		}
		const arrayBuffer = await response.arrayBuffer();
		return await ctx.decodeAudioData(arrayBuffer);
	} catch (e) {
		console.warn(`Failed to load audio: ${filename}`, e);
		return null;
	}
}

async function preload(): Promise<void> {
	if (preloaded) return;

	// Initialize AudioContext (may be suspended until user interaction)
	getAudioContext();

	// Load all voice cue files
	const loadPromises = VOICE_FILES.map(async (cue) => {
		const filename = `${cue}.mp3`;
		const buffer = await loadAudioBuffer(filename);
		if (buffer) {
			buffers.set(cue, buffer);
		}
	});

	await Promise.all(loadPromises);
	preloaded = true;
	console.log(`Audio preloaded: ${buffers.size}/${VOICE_FILES.length} files`);
}

// ============================================================================
// Mute State
// ============================================================================

class AudioService {
	isMuted = $state(false);

	mute() {
		this.isMuted = true;
	}

	unmute() {
		this.isMuted = false;
	}

	toggleMute() {
		this.isMuted = !this.isMuted;
	}

	// Expose preload
	preload = preload;

	// Placeholder methods - implemented in Part 2
	async playCountdownBeep(value: CountdownValue): Promise<void> {
		// Implemented in Task 5
	}

	async playVoiceCue(cue: VoiceCueType): Promise<void> {
		// Implemented in Task 5
	}

	scheduleForTimer(config: TimerConfig, startTime: number): void {
		// Implemented in Task 6
	}

	cancelAll(): void {
		// Implemented in Task 5
	}

	reschedule(config: TimerConfig, remainingMs: number): void {
		// Implemented in Task 6
	}
}

export const audioService = new AudioService();
