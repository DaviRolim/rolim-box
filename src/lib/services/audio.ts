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

// ============================================================================
// Playback Functions
// ============================================================================

function playBeep(frequency: number, duration: number, atTime?: number): OscillatorNode {
	const ctx = getAudioContext();
	const oscillator = ctx.createOscillator();
	const gainNode = ctx.createGain();

	oscillator.type = 'sine';
	oscillator.frequency.value = frequency;
	oscillator.connect(gainNode);
	gainNode.connect(ctx.destination);

	const startTime = atTime ?? ctx.currentTime;
	const endTime = startTime + duration / 1000;

	// Fade out to avoid click
	gainNode.gain.setValueAtTime(0.5, startTime);
	gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

	oscillator.start(startTime);
	oscillator.stop(endTime);

	return oscillator;
}

function playVoiceBuffer(cue: string, atTime?: number): AudioBufferSourceNode | null {
	const buffer = buffers.get(cue);
	if (!buffer) {
		console.warn(`Audio buffer not found: ${cue}`);
		return null;
	}

	const ctx = getAudioContext();
	const source = ctx.createBufferSource();
	source.buffer = buffer;
	source.connect(ctx.destination);
	source.start(atTime ?? ctx.currentTime);

	return source;
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

	preload = preload;

	async playCountdownBeep(value: CountdownValue): Promise<void> {
		if (this.isMuted) return;
		await ensureContextResumed();

		const config = audioConfig.universal.countdown[String(value) as '3' | '2' | '1'];
		if (config.type === 'beep') {
			playBeep(config.frequency, config.duration);
		}
	}

	async playVoiceCue(cue: VoiceCueType): Promise<void> {
		if (this.isMuted) return;
		await ensureContextResumed();

		playVoiceBuffer(cue);
	}

	cancelAll(): void {
		scheduledNodes.forEach((node) => {
			try {
				node.stop();
			} catch {
				// Node may already be stopped
			}
		});
		scheduledNodes = [];
	}

	scheduleForTimer(config: TimerConfig, startTime: number): void {
		// Implemented in Task 6
	}

	reschedule(config: TimerConfig, remainingMs: number): void {
		// Implemented in Task 6
	}
}

export const audioService = new AudioService();
