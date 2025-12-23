# Phase 4: Audio Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add audio cues to RolimBox timers with hybrid voice/beep approach using Web Audio API for precise scheduling.

**Architecture:** Modular audio service with JSON configuration, Web Audio API scheduling for precise playback, cancel-and-reschedule on pause/resume, deferred preloading on app init.

**Tech Stack:** Web Audio API, Svelte 5 runes, TypeScript, MP3 audio files (TTS-generated)

---

## Task 1: Create Audio Type Definitions

**Files:**
- Create: `src/lib/types/audio.ts`

**Step 1: Create the audio types file**

```typescript
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
```

**Step 2: Verify the file was created**

Run: `cat src/lib/types/audio.ts | head -20`
Expected: First 20 lines of the types file

**Step 3: Commit**

```bash
git add src/lib/types/audio.ts
git commit -m "feat(audio): add audio type definitions"
```

---

## Task 2: Create Audio Configuration JSON

**Files:**
- Create: `src/lib/config/audio-config.json`

**Step 1: Create the JSON configuration file**

```json
{
	"universal": {
		"countdown": {
			"3": { "type": "beep", "frequency": 440, "duration": 150 },
			"2": { "type": "beep", "frequency": 550, "duration": 150 },
			"1": { "type": "beep", "frequency": 660, "duration": 150 },
			"go": { "type": "voice", "file": "go.mp3" }
		},
		"checkpoints": [
			{ "id": "halfway", "type": "voice", "file": "halfway.mp3" },
			{ "id": "one-minute", "remainingMs": 60000, "type": "voice", "file": "one-minute.mp3" },
			{ "id": "thirty-seconds", "remainingMs": 30000, "type": "voice", "file": "thirty-seconds.mp3" },
			{ "id": "ten-seconds", "remainingMs": 10000, "type": "voice", "file": "ten-seconds.mp3" }
		],
		"completion": { "type": "voice", "file": "time.mp3" }
	},
	"emom": {
		"roundTransition": { "type": "voice", "file": "next-round.mp3" },
		"roundWarning": { "remainingMs": 5000, "type": "beep", "frequency": 880, "duration": 100 }
	},
	"tabata": {
		"workPhase": { "type": "voice", "file": "work.mp3" },
		"restPhase": { "type": "voice", "file": "rest.mp3" }
	}
}
```

**Step 2: Verify the file was created**

Run: `cat src/lib/config/audio-config.json`
Expected: Full JSON config

**Step 3: Commit**

```bash
git add src/lib/config/audio-config.json
git commit -m "feat(audio): add audio configuration JSON"
```

---

## Task 3: Create Static Audio Directory and Placeholder Files

**Files:**
- Create: `static/audio/voice/` directory
- Create: `static/audio/voice/.gitkeep`

**Step 1: Create the audio directory structure**

```bash
mkdir -p static/audio/voice
```

**Step 2: Create a .gitkeep to track the directory**

```bash
touch static/audio/voice/.gitkeep
```

**Step 3: Verify**

Run: `ls -la static/audio/voice/`
Expected: `.gitkeep` file present

**Step 4: Commit**

```bash
git add static/audio/voice/.gitkeep
git commit -m "chore: add audio directory structure"
```

---

## Task 4: Implement Core Audio Service - Part 1 (AudioContext & Buffers)

**Files:**
- Create: `src/lib/services/audio.ts`

**Step 1: Create audio service with AudioContext management and buffer loading**

```typescript
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
```

**Step 2: Verify the file compiles**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check 2>&1 | head -30`
Expected: No errors related to audio.ts (may have warnings about unused)

**Step 3: Commit**

```bash
git add src/lib/services/audio.ts
git commit -m "feat(audio): add audio service core (context, buffers, mute)"
```

---

## Task 5: Implement Audio Service - Part 2 (Playback Functions)

**Files:**
- Modify: `src/lib/services/audio.ts`

**Step 1: Implement beep playback function**

Add after the `loadAudioBuffer` function (before the `preload` function):

```typescript
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
```

**Step 2: Update the AudioService class methods**

Replace the placeholder methods in the `AudioService` class:

```typescript
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
```

**Step 3: Verify the file compiles**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check 2>&1 | head -30`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/services/audio.ts
git commit -m "feat(audio): add playback functions (beep, voice, cancel)"
```

---

## Task 6: Implement Audio Service - Part 3 (Scheduling)

**Files:**
- Modify: `src/lib/services/audio.ts`

**Step 1: Add checkpoint calculation function**

Add after the playback functions (before `preload`):

```typescript
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
```

**Step 2: Update scheduleForTimer and reschedule methods in AudioService class**

Replace the placeholder implementations:

```typescript
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
```

**Step 3: Verify the file compiles**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check 2>&1 | head -30`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/services/audio.ts
git commit -m "feat(audio): add checkpoint calculation and scheduling"
```

---

## Task 7: Integrate Audio with Timer Store - Countdown Beeps

**Files:**
- Modify: `src/lib/stores/timer.svelte.ts`

**Step 1: Import audioService**

Add at the top of the file after existing imports:

```typescript
import { audioService } from '$lib/services/audio';
```

**Step 2: Add countdown beeps to start() method**

Modify the `start()` method to play countdown beeps. Replace the countdown loop:

```typescript
	async start() {
		if (this.state !== 'idle' || !this.config) return;

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

		// Start timer and schedule audio checkpoints
		this.state = 'running';
		this.engine = createTimerEngine({
			onTick: (deltaMs) => this.handleTick(deltaMs)
		});
		this.engine.start();

		// Schedule all audio checkpoints
		const ctx = new AudioContext();
		audioService.scheduleForTimer(this.config, ctx.currentTime);
	}
```

**Step 3: Verify the file compiles**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check 2>&1 | head -30`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/stores/timer.svelte.ts
git commit -m "feat(audio): integrate countdown beeps with timer store"
```

---

## Task 8: Integrate Audio with Timer Store - Pause/Resume/Reset

**Files:**
- Modify: `src/lib/stores/timer.svelte.ts`

**Step 1: Update pause() method**

```typescript
	pause() {
		if (this.state !== 'running') return;
		this.state = 'paused';
		this.engine?.pause();
		audioService.cancelAll();
	}
```

**Step 2: Update resume() method**

```typescript
	resume() {
		if (this.state !== 'paused' || !this.config) return;
		this.state = 'running';
		this.engine?.resume();
		audioService.reschedule(this.config, this.remainingMs);
	}
```

**Step 3: Update stop() method**

```typescript
	stop() {
		this.engine?.stop();
		this.state = 'completed';
		audioService.cancelAll();
	}
```

**Step 4: Update reset() method**

```typescript
	reset() {
		this.engine?.stop();
		this.engine = null;
		this.state = 'idle';
		this.elapsedMs = 0;
		this.currentRound = 1;
		this.isWorkPhase = true;
		this.completedRounds = 0;
		this.countdownValue = null;
		audioService.cancelAll();
	}
```

**Step 5: Verify the file compiles**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check 2>&1 | head -30`
Expected: No errors

**Step 6: Commit**

```bash
git add src/lib/stores/timer.svelte.ts
git commit -m "feat(audio): integrate pause/resume/reset audio handling"
```

---

## Task 9: Add Mute Button to Timer Display

**Files:**
- Modify: `src/lib/components/timer/TimerDisplay.svelte`

**Step 1: Import audioService**

Add at the top of the script section after existing imports:

```typescript
import { audioService } from '$lib/services/audio';
```

**Step 2: Add mute button to header**

Replace the header section with:

```svelte
	<!-- Header -->
	<header class="timer-header">
		<span class="timer-type">
			{timerStore.config ? TIMER_LABELS[timerStore.config.type] : ''}
			{#if timerStore.config?.type === 'fortime'}
				<span class="timer-cap">(cap: {formatTime(timerStore.config.duration!)})</span>
			{/if}
		</span>
		<div class="header-actions">
			<button
				type="button"
				class="mute-btn"
				onclick={() => audioService.toggleMute()}
				aria-label={audioService.isMuted ? 'Unmute' : 'Mute'}
			>
				{#if audioService.isMuted}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11 5L6 9H2v6h4l5 4V5z" />
						<line x1="23" y1="9" x2="17" y2="15" />
						<line x1="17" y1="9" x2="23" y2="15" />
					</svg>
				{:else}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11 5L6 9H2v6h4l5 4V5z" />
						<path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
					</svg>
				{/if}
			</button>
			<button type="button" class="exit-btn" onclick={handleExit} aria-label="Exit timer">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" stroke-linecap="square" />
				</svg>
			</button>
		</div>
	</header>
```

**Step 3: Add mute button styles**

Add to the `<style>` section:

```css
	.header-actions {
		display: flex;
		gap: 8px;
	}

	.mute-btn {
		width: 48px;
		height: 48px;
		background: transparent;
		border: 2px solid #2a2a2a;
		color: #737373;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.mute-btn:hover {
		border-color: #e91e8c;
		color: #e91e8c;
	}
```

**Step 4: Verify the file compiles**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check 2>&1 | head -30`
Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/components/timer/TimerDisplay.svelte
git commit -m "feat(audio): add mute button to timer display"
```

---

## Task 10: Add Deferred Audio Preloading to App Layout

**Files:**
- Modify: `src/routes/(app)/+layout.svelte`

**Step 1: Import audioService and onMount**

Add at the top of the script section:

```typescript
<script lang="ts">
	import { onMount } from 'svelte';
	import { audioService } from '$lib/services/audio';
	import OfflineBanner from '$lib/components/OfflineBanner.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';

	let { data, children } = $props();

	onMount(() => {
		// Defer audio preloading to avoid blocking initial render
		if ('requestIdleCallback' in window) {
			requestIdleCallback(() => audioService.preload());
		} else {
			// Fallback for Safari
			setTimeout(() => audioService.preload(), 1000);
		}
	});
</script>
```

**Step 2: Verify the file compiles**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check 2>&1 | head -30`
Expected: No errors

**Step 3: Commit**

```bash
git add src/routes/(app)/+layout.svelte
git commit -m "feat(audio): add deferred audio preloading on app init"
```

---

## Task 11: Update Service Worker for Audio Caching

**Files:**
- Modify: `static/sw.js`

**Step 1: Add audio files to static assets**

Update the `STATIC_ASSETS` array:

```javascript
const CACHE_NAME = 'rolimbox-v2'; // Bump version
const STATIC_ASSETS = [
	'/',
	'/manifest.json',
	'/icons/icon-192.png',
	'/icons/icon-512.png',
	// Audio files
	'/audio/voice/go.mp3',
	'/audio/voice/halfway.mp3',
	'/audio/voice/one-minute.mp3',
	'/audio/voice/thirty-seconds.mp3',
	'/audio/voice/ten-seconds.mp3',
	'/audio/voice/time.mp3',
	'/audio/voice/next-round.mp3',
	'/audio/voice/work.mp3',
	'/audio/voice/rest.mp3'
];
```

**Step 2: Verify the service worker is valid**

Run: `cat static/sw.js | head -20`
Expected: Updated STATIC_ASSETS array

**Step 3: Commit**

```bash
git add static/sw.js
git commit -m "feat(audio): add audio files to service worker cache"
```

---

## Task 12: Generate TTS Audio Files

**Files:**
- Create: `static/audio/voice/go.mp3`
- Create: `static/audio/voice/halfway.mp3`
- Create: `static/audio/voice/one-minute.mp3`
- Create: `static/audio/voice/thirty-seconds.mp3`
- Create: `static/audio/voice/ten-seconds.mp3`
- Create: `static/audio/voice/time.mp3`
- Create: `static/audio/voice/next-round.mp3`
- Create: `static/audio/voice/work.mp3`
- Create: `static/audio/voice/rest.mp3`

**Step 1: Generate audio files using TTS**

Use one of these options:

**Option A: ElevenLabs (recommended for quality)**
1. Go to https://elevenlabs.io
2. Select an energetic voice (e.g., "Adam" or "Josh")
3. Generate each phrase:
   - "Go!" → save as `go.mp3`
   - "Halfway!" → save as `halfway.mp3`
   - "One minute!" → save as `one-minute.mp3`
   - "Thirty seconds!" → save as `thirty-seconds.mp3`
   - "Ten seconds!" → save as `ten-seconds.mp3`
   - "Time!" → save as `time.mp3`
   - "Next round!" → save as `next-round.mp3`
   - "Work!" → save as `work.mp3`
   - "Rest!" → save as `rest.mp3`

**Option B: Amazon Polly**
1. Go to AWS Console → Amazon Polly
2. Select "Matthew" or "Joanna" voice
3. Generate each phrase and download

**Option C: macOS say command (development placeholder)**
```bash
cd static/audio/voice
say -v Alex "Go!" -o go.aiff && ffmpeg -i go.aiff go.mp3 && rm go.aiff
say -v Alex "Halfway!" -o halfway.aiff && ffmpeg -i halfway.aiff halfway.mp3 && rm halfway.aiff
say -v Alex "One minute!" -o one-minute.aiff && ffmpeg -i one-minute.aiff one-minute.mp3 && rm one-minute.aiff
say -v Alex "Thirty seconds!" -o thirty-seconds.aiff && ffmpeg -i thirty-seconds.aiff thirty-seconds.mp3 && rm thirty-seconds.aiff
say -v Alex "Ten seconds!" -o ten-seconds.aiff && ffmpeg -i ten-seconds.aiff ten-seconds.mp3 && rm ten-seconds.aiff
say -v Alex "Time!" -o time.aiff && ffmpeg -i time.aiff time.mp3 && rm time.aiff
say -v Alex "Next round!" -o next-round.aiff && ffmpeg -i next-round.aiff next-round.mp3 && rm next-round.aiff
say -v Alex "Work!" -o work.aiff && ffmpeg -i work.aiff work.mp3 && rm work.aiff
say -v Alex "Rest!" -o rest.aiff && ffmpeg -i rest.aiff rest.mp3 && rm rest.aiff
```

**Option D: espeak on Linux (development placeholder)**
```bash
cd static/audio/voice
espeak -w go.wav "Go!" && ffmpeg -i go.wav go.mp3 && rm go.wav
espeak -w halfway.wav "Halfway!" && ffmpeg -i halfway.wav halfway.mp3 && rm halfway.wav
espeak -w one-minute.wav "One minute!" && ffmpeg -i one-minute.wav one-minute.mp3 && rm one-minute.wav
espeak -w thirty-seconds.wav "Thirty seconds!" && ffmpeg -i thirty-seconds.wav thirty-seconds.mp3 && rm thirty-seconds.wav
espeak -w ten-seconds.wav "Ten seconds!" && ffmpeg -i ten-seconds.wav ten-seconds.mp3 && rm ten-seconds.wav
espeak -w time.wav "Time!" && ffmpeg -i time.wav time.mp3 && rm time.wav
espeak -w next-round.wav "Next round!" && ffmpeg -i next-round.wav next-round.mp3 && rm next-round.wav
espeak -w work.wav "Work!" && ffmpeg -i work.wav work.mp3 && rm work.wav
espeak -w rest.wav "Rest!" && ffmpeg -i rest.wav rest.mp3 && rm rest.wav
```

**Step 2: Verify all files exist**

Run: `ls -la static/audio/voice/*.mp3`
Expected: 9 MP3 files

**Step 3: Remove .gitkeep (no longer needed)**

```bash
rm static/audio/voice/.gitkeep
```

**Step 4: Commit**

```bash
git add static/audio/voice/
git commit -m "feat(audio): add TTS-generated voice cue audio files"
```

---

## Task 13: Manual Testing

**Step 1: Start the dev server**

Run: `bun run dev`

**Step 2: Test countdown beeps**

1. Navigate to Timer page
2. Select AMRAP (quick test)
3. Set to 1 minute
4. Click Start
5. Verify: Beeps play at 3, 2, 1 and "Go!" voice plays

**Step 3: Test mute button**

1. Start a timer
2. Click mute button
3. Verify: Icon changes to muted
4. Reset and start again
5. Verify: No audio plays

**Step 4: Test pause/resume audio**

1. Start a 2-minute AMRAP
2. Wait until after halfway (after 1 minute)
3. Pause
4. Resume
5. Verify: "30 seconds" and "10 seconds" cues still play

**Step 5: Test TABATA work/rest cues**

1. Select TABATA
2. Set 3 rounds, 10s work, 10s rest
3. Start
4. Verify: "Work!" plays after GO, "Rest!" plays after work phase

**Step 6: Test EMOM round transitions**

1. Select EMOM
2. Set 3 rounds, 15 second interval
3. Start
4. Verify: "Next round!" plays at round transitions

**Step 7: Test completion cue**

1. Run any short timer to completion
2. Verify: "Time!" plays at the end

---

## Task 14: Final Commit and Verification

**Step 1: Run full type check**

Run: `bun run check`
Expected: No errors

**Step 2: Run the build**

Run: `bun run build`
Expected: Successful build

**Step 3: Final commit (if any uncommitted changes)**

```bash
git status
# If clean, skip
# If changes exist:
git add .
git commit -m "chore(audio): final cleanup"
```

---

## Success Criteria Checklist

- [ ] All four timer types play appropriate audio cues
- [ ] Countdown sequence plays beeps (3-2-1) and "Go!" voice
- [ ] Universal checkpoints (halfway, 1min, 30s, 10s, completion) work
- [ ] EMOM plays "Next round!" at transitions
- [ ] TABATA plays "Work!" and "Rest!" at phase changes
- [ ] Pause cancels scheduled audio, resume reschedules correctly
- [ ] Mute toggle works and persists during session
- [ ] Audio works offline after first load
- [ ] No perceptible delay on timer start (preloading works)
- [ ] Audio timing is precise (no drift from visual timer)
