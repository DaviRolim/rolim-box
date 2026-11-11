// src/lib/services/audio.svelte.ts
import type { AudioConfig, CountdownValue, VoiceCueType } from '$lib/types/audio';
import audioConfigJson from '$lib/config/audio-config.json';
import { VoicePlayer, configureAudioSession, pickTake } from './voice-player';

const audioConfig = audioConfigJson as AudioConfig;

// ============================================================================
// Audio Context Management
// ============================================================================

let audioContext: AudioContext | null = null;
// Plain caches: nothing renders from them, so they do not need to be reactive.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const decodedBuffers = new Map<string, AudioBuffer>();
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const rawBuffers = new Map<string, ArrayBuffer>();
let prefetching: Promise<void> | null = null;
let audioUnlocked = false;

// Voice cues: media elements, so other apps' music ducks under them (see voice-player.ts).
// Beeps stay on the AudioContext below.
const voicePlayer = new VoicePlayer<VoiceFile>({
	createElement: () => new Audio()
});
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const blobUrls = new Map<VoiceFile, string>();

function getAudioContext(): AudioContext {
	if (!audioContext) {
		const Ctx =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!Ctx) throw new Error('AudioContext not supported');
		audioContext = new Ctx();
	}
	return audioContext;
}

/**
 * Unlock audio for iOS Safari, from a tap.
 * iOS requires a buffer source to be started during a user gesture
 * to fully unlock the AudioContext -- ctx.resume() alone is not sufficient.
 * The voice media elements need their own play() inside the gesture too.
 */
function unlockAudioContext(): void {
	configureAudioSession(navigator);
	// Media elements are unlocked one by one, and only once their file has arrived, so this
	// runs on every tap until all are done (each element is skipped once unlocked).
	voicePlayer.unlock(VOICE_FILES);
	// A tap before the idle preload ran (e.g. straight into a timer): start loading now.
	void preload();
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

/**
 * How many recorded takes each cue has: static/audio/voice/<cue>-<n>.mp3, n = 1..count.
 * Coach voice "Adam" (ElevenLabs eleven_v3). Every take stays under ~3 s, so a cue ends before
 * the next sound fires (ten-seconds plays at 0:10, the 3-2-1 beeps start at 0:03).
 */
export const VOICE_VARIANTS: Record<VoiceCueType, number> = {
	go: 3,
	halfway: 3,
	'half-emom': 2,
	'one-minute': 3,
	'thirty-seconds': 1,
	'ten-seconds': 3,
	time: 3,
	'next-round': 3,
	work: 2,
	rest: 2
};

/** One recorded take of a cue, e.g. "ten-seconds-2". */
type VoiceFile = `${VoiceCueType}-${number}`;

const VOICE_FILES: VoiceFile[] = (Object.keys(VOICE_VARIANTS) as VoiceCueType[]).flatMap((cue) =>
	Array.from({ length: VOICE_VARIANTS[cue] }, (_, i): VoiceFile => `${cue}-${i + 1}`)
);

// eslint-disable-next-line svelte/prefer-svelte-reactivity
const lastTake = new Map<VoiceCueType, number>();

function nextTake(cue: VoiceCueType): VoiceFile {
	const take = pickTake(VOICE_VARIANTS[cue], lastTake.get(cue));
	lastTake.set(cue, take);
	return `${cue}-${take}`;
}

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

/** Fetch every cue once. Memoised, so repeated taps while it runs do not fetch again. */
function preload(): Promise<void> {
	prefetching ??= prefetchAll();
	return prefetching;
}

async function prefetchAll(): Promise<void> {
	// Only fetch raw audio data - don't create AudioContext yet
	// AudioContext must be created on user interaction to comply with browser autoplay policies
	const fetchPromises = VOICE_FILES.map(async (cue) => {
		const filename = `${cue}.mp3`;
		const arrayBuffer = await fetchAudioFile(filename);
		if (arrayBuffer) {
			rawBuffers.set(cue, arrayBuffer);
			attachVoiceSource(cue, arrayBuffer);
		}
	});

	await Promise.all(fetchPromises);
	console.log(`Audio prefetched: ${rawBuffers.size}/${VOICE_FILES.length} files`);
}

/**
 * The element plays a blob: URL of the bytes fetched above, not /audio/voice/<cue>.mp3:
 * the file is then in memory (no network or cache lookup when the cue fires), and media range
 * requests never reach the service worker, whose cached 200 responses Safari refuses for media.
 * The fetch itself still goes through the service worker, so cues keep working offline.
 */
function attachVoiceSource(cue: VoiceFile, bytes: ArrayBuffer): void {
	if (typeof Audio === 'undefined' || blobUrls.has(cue)) return;
	try {
		const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
		blobUrls.set(cue, url);
		voicePlayer.setSource(cue, url);
	} catch (e) {
		console.warn(`Failed to prepare voice element: ${cue}`, e);
	}
}

async function getDecodedBuffer(cue: VoiceFile): Promise<AudioBuffer | null> {
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

	// Flat tone with a short fade at the end (box-clock beep, no click). Short beeps fade over
	// their last third, long tones over their last 80 ms.
	const fade = Math.min(0.08, duration / 3000);
	gainNode.gain.setValueAtTime(0.5, startTime);
	gainNode.gain.setValueAtTime(0.5, endTime - fade);
	gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

	oscillator.start(startTime);
	oscillator.stop(endTime);
}

/** Fallback only: used when the media element refuses to play (e.g. iOS never unlocked it). */
async function playVoiceBufferNow(cue: VoiceFile): Promise<void> {
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
		voicePlayer.stopAll();
	}

	unmute() {
		this.isMuted = false;
	}

	toggleMute() {
		this.isMuted = !this.isMuted;
		if (this.isMuted) voicePlayer.stopAll();
	}

	unlockAudio = unlockAudioContext;

	/** True once the AudioContext and every voice element have been unlocked by a tap. */
	get isUnlocked(): boolean {
		return audioUnlocked && voicePlayer.isUnlocked(VOICE_FILES);
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

	/** Play one take of a cue (a random one when the cue has several). */
	async playVoiceCue(cue: VoiceCueType): Promise<void> {
		if (this.isMuted) return;
		const take = nextTake(cue);
		if (voicePlayer.hasSource(take)) {
			try {
				await voicePlayer.play(take);
				return;
			} catch (e) {
				console.warn(`Voice element refused to play, using Web Audio: ${take}`, e);
			}
		}
		await ensureContextResumed();
		await playVoiceBufferNow(take);
	}

	/** The long, higher tone of the box clock: on GO and when the clock runs out. */
	async playStartTone(): Promise<void> {
		if (this.isMuted) return;
		await ensureContextResumed();
		const tone = audioConfig.universal.tone;
		playBeepNow(tone.frequency, tone.duration);
	}
}

export const audioService = new AudioService();
