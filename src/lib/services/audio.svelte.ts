// src/lib/services/audio.svelte.ts
import type { AudioConfig, CountdownValue, VoiceCueType } from '$lib/types/audio';
import audioConfigJson from '$lib/config/audio-config.json';

const audioConfig = audioConfigJson as AudioConfig;

// ============================================================================
// Audio Context Management
// ============================================================================

let audioContext: AudioContext | null = null;
const decodedBuffers = new Map<string, AudioBuffer>();
const rawBuffers = new Map<string, ArrayBuffer>();
let prefetched = false;
let audioUnlocked = false;

function getAudioContext(): AudioContext {
	if (!audioContext) {
		const Ctx = window.AudioContext || (window as any).webkitAudioContext;
		if (!Ctx) throw new Error('AudioContext not supported');
		audioContext = new Ctx();
	}
	return audioContext;
}

/**
 * Unlock AudioContext for iOS Safari.
 * iOS requires a buffer source to be started during a user gesture
 * to fully unlock the AudioContext -- ctx.resume() alone is not sufficient.
 */
function unlockAudioContext(): void {
	if (audioUnlocked) return;
	try {
		const ctx = getAudioContext();
		// Play a silent buffer (1 sample) to unlock
		const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		source.connect(ctx.destination);
		source.start(0);
		if (ctx.state === 'suspended') {
			ctx.resume();
		}
		audioUnlocked = true;
	} catch (e) {
		console.warn('Failed to unlock audio context:', e);
	}
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

async function fetchAudioFile(filename: string): Promise<ArrayBuffer | null> {
	try {
		const response = await fetch(`/audio/voice/${filename}`);
		if (!response.ok) {
			console.warn(`Audio file not found: ${filename}`);
			return null;
		}
		return await response.arrayBuffer();
	} catch (e) {
		console.warn(`Failed to fetch audio: ${filename}`, e);
		return null;
	}
}

async function preload(): Promise<void> {
	if (prefetched) return;

	// Only fetch raw audio data - don't create AudioContext yet
	// AudioContext must be created on user interaction to comply with browser autoplay policies
	const fetchPromises = VOICE_FILES.map(async (cue) => {
		const filename = `${cue}.mp3`;
		const arrayBuffer = await fetchAudioFile(filename);
		if (arrayBuffer) {
			rawBuffers.set(cue, arrayBuffer);
		}
	});

	await Promise.all(fetchPromises);
	prefetched = true;
	console.log(`Audio prefetched: ${rawBuffers.size}/${VOICE_FILES.length} files`);
}

async function getDecodedBuffer(cue: VoiceCueType): Promise<AudioBuffer | null> {
	// Return cached decoded buffer if available
	if (decodedBuffers.has(cue)) {
		return decodedBuffers.get(cue)!;
	}

	// Get raw buffer
	const rawBuffer = rawBuffers.get(cue);
	if (!rawBuffer) {
		console.warn(`Raw audio buffer not found: ${cue}`);
		return null;
	}

	// Decode on demand (AudioContext exists at this point due to user interaction)
	try {
		const ctx = getAudioContext();
		// Need to clone ArrayBuffer since decodeAudioData detaches it
		const clonedBuffer = rawBuffer.slice(0);
		const decoded = await ctx.decodeAudioData(clonedBuffer);
		decodedBuffers.set(cue, decoded);
		return decoded;
	} catch (e) {
		console.warn(`Failed to decode audio: ${cue}`, e);
		return null;
	}
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

async function playVoiceBufferNow(cue: VoiceCueType): Promise<void> {
	const buffer = await getDecodedBuffer(cue);
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

	unlockAudio = unlockAudioContext;

	get isUnlocked(): boolean {
		return audioUnlocked;
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
		await playVoiceBufferNow(cue);
	}
}

export const audioService = new AudioService();
