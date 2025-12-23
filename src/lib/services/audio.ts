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

// ============================================================================
// Checkpoint Calculation
// ============================================================================

function calculateCheckpoints(config: TimerConfig): ScheduledCheckpoint[] {
	const totalMs = getTotalDuration(config) * 1000;
	const checkpoints: ScheduledCheckpoint[] = [];

	// Universal checkpoints
	for (const cp of audioConfig.universal.checkpoints) {
		let triggerMs: number;

		if (cp.id === 'halfway') {
			// Halfway is 50% of total duration
			triggerMs = totalMs / 2;
		} else if (cp.remainingMs !== undefined) {
			// Time-based checkpoint (e.g., "1 minute remaining")
			triggerMs = totalMs - cp.remainingMs;
		} else {
			continue;
		}

		// Skip if checkpoint is before start or after end
		if (triggerMs <= 0 || triggerMs >= totalMs) continue;

		checkpoints.push({
			triggerMs,
			type: cp.type,
			file: cp.file,
			frequency: cp.frequency,
			duration: cp.duration
		});
	}

	// Completion cue
	checkpoints.push({
		triggerMs: totalMs,
		type: 'voice',
		file: audioConfig.universal.completion.file
	});

	// Timer-specific checkpoints
	if (config.type === 'emom') {
		const intervalMs = config.intervalWork! * 1000;
		const rounds = config.rounds!;

		// Round transitions (except first round)
		for (let round = 2; round <= rounds; round++) {
			const transitionMs = (round - 1) * intervalMs;
			checkpoints.push({
				triggerMs: transitionMs,
				type: 'voice',
				file: audioConfig.emom.roundTransition.file
			});

			// 5-second warning before round transition
			const warningMs = transitionMs - audioConfig.emom.roundWarning.remainingMs;
			if (warningMs > 0) {
				checkpoints.push({
					triggerMs: warningMs,
					type: 'beep',
					frequency: audioConfig.emom.roundWarning.frequency,
					duration: audioConfig.emom.roundWarning.duration
				});
			}
		}
	}

	if (config.type === 'tabata') {
		const workMs = config.intervalWork! * 1000;
		const restMs = config.intervalRest! * 1000;
		const cycleMs = workMs + restMs;
		const rounds = config.rounds!;

		for (let round = 1; round <= rounds; round++) {
			const cycleStart = (round - 1) * cycleMs;

			// Work phase at cycle start (skip first - that's the GO)
			if (round > 1) {
				checkpoints.push({
					triggerMs: cycleStart,
					type: 'voice',
					file: audioConfig.tabata.workPhase.file
				});
			}

			// Rest phase after work
			checkpoints.push({
				triggerMs: cycleStart + workMs,
				type: 'voice',
				file: audioConfig.tabata.restPhase.file
			});
		}
	}

	// Sort by trigger time
	return checkpoints.sort((a, b) => a.triggerMs - b.triggerMs);
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
		if (this.isMuted) return;

		const ctx = getAudioContext();
		const checkpoints = calculateCheckpoints(config);

		for (const cp of checkpoints) {
			const playAtTime = startTime + cp.triggerMs / 1000;

			if (cp.type === 'beep' && cp.frequency && cp.duration) {
				const node = playBeep(cp.frequency, cp.duration, playAtTime);
				scheduledNodes.push(node);
			} else if (cp.type === 'voice' && cp.file) {
				const cue = cp.file.replace('.mp3', '') as VoiceCueType;
				const node = playVoiceBuffer(cue, playAtTime);
				if (node) {
					scheduledNodes.push(node);
				}
			}
		}
	}

	reschedule(config: TimerConfig, remainingMs: number): void {
		this.cancelAll();

		if (this.isMuted) return;

		const ctx = getAudioContext();
		const totalMs = getTotalDuration(config) * 1000;
		const elapsedMs = totalMs - remainingMs;
		const checkpoints = calculateCheckpoints(config);

		// Filter to only future checkpoints
		const futureCheckpoints = checkpoints.filter((cp) => cp.triggerMs > elapsedMs);

		for (const cp of futureCheckpoints) {
			// Calculate when to play relative to now
			const delayMs = cp.triggerMs - elapsedMs;
			const playAtTime = ctx.currentTime + delayMs / 1000;

			if (cp.type === 'beep' && cp.frequency && cp.duration) {
				const node = playBeep(cp.frequency, cp.duration, playAtTime);
				scheduledNodes.push(node);
			} else if (cp.type === 'voice' && cp.file) {
				const cue = cp.file.replace('.mp3', '') as VoiceCueType;
				const node = playVoiceBuffer(cue, playAtTime);
				if (node) {
					scheduledNodes.push(node);
				}
			}
		}
	}
}

export const audioService = new AudioService();
