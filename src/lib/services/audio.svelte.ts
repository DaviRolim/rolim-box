// src/lib/services/audio.svelte.ts
import type { AudioConfig, CountdownValue, VoiceCueType } from '$lib/types/audio';
import audioConfigJson from '$lib/config/audio-config.json';

const audioConfig = audioConfigJson as AudioConfig;

// ============================================================================
// Audio Context Management
// ============================================================================

let audioContext: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
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
	'half-emom',
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
// Immediate Playback Functions
// ============================================================================

function playBeepNow(frequency: number, duration: number): void {
	const ctx = getAudioContext();
	const oscillator = ctx.createOscillator();
	const gainNode = ctx.createGain();

	oscillator.type = 'sine';
	oscillator.frequency.value = frequency;
	oscillator.connect(gainNode);
	gainNode.connect(ctx.destination);

	const startTime = ctx.currentTime;
	const endTime = startTime + duration / 1000;

	// Fade out to avoid click
	gainNode.gain.setValueAtTime(0.5, startTime);
	gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

	oscillator.start(startTime);
	oscillator.stop(endTime);
}

function playVoiceBufferNow(cue: VoiceCueType): void {
	const buffer = buffers.get(cue);
	if (!buffer) {
		console.warn(`Audio buffer not found: ${cue}`);
		return;
	}

	const ctx = getAudioContext();
	const source = ctx.createBufferSource();
	source.buffer = buffer;
	source.connect(ctx.destination);
	source.start();
}

// ============================================================================
// Audio Service Class
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
			playBeepNow(config.frequency, config.duration);
		}
	}

	async playBeep(frequency: number, duration: number): Promise<void> {
		if (this.isMuted) return;
		await ensureContextResumed();
		playBeepNow(frequency, duration);
	}

	async playVoiceCue(cue: VoiceCueType): Promise<void> {
		if (this.isMuted) return;
		await ensureContextResumed();
		playVoiceBufferNow(cue);
	}
}

export const audioService = new AudioService();
