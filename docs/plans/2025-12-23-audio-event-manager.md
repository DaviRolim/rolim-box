# Audio Event Manager Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract audio event logic from TimerStore into a config-driven AudioEventManager for extensibility.

**Architecture:** Config-driven event system where timer types define their audio events declaratively in JSON. AudioEventManager reads config, tracks played events, and executes actions via AudioService. TimerStore calls event manager on each tick with context.

**Tech Stack:** Svelte 5 (runes), TypeScript, Web Audio API

---

### Task 1: Add Event Types to audio.ts

**Files:**
- Modify: `src/lib/types/audio.ts`

**Step 1: Add EventTrigger type**

Add after the existing types (after line 84):

```typescript
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
```

**Step 2: Add EventAction type**

Add after EventTrigger:

```typescript
export type EventAction =
	| { type: 'voice'; cue: VoiceCueType }
	| { type: 'beep'; frequency: number; duration: number }
	| { type: 'countdown' };
```

**Step 3: Add AudioEvent interface**

Add after EventAction:

```typescript
export interface AudioEvent {
	trigger: EventTrigger;
	action: EventAction;
}
```

**Step 4: Add AudioCheckContext interface**

Add after AudioEvent:

```typescript
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
```

**Step 5: Add TimerEventsConfig type**

Add after AudioCheckContext:

```typescript
export type TimerEventsConfig = AudioEvent[] | string;
```

**Step 6: Update AudioConfig interface**

Replace the existing AudioConfig interface with:

```typescript
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
```

**Step 7: Verify TypeScript compiles**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check`
Expected: No type errors

**Step 8: Commit**

```bash
git add src/lib/types/audio.ts
git commit -m "feat(audio): add event system types for config-driven audio"
```

---

### Task 2: Restructure audio-config.json

**Files:**
- Modify: `src/lib/config/audio-config.json`

**Step 1: Replace entire config file**

Replace contents with:

```json
{
	"universal": {
		"countdown": {
			"3": { "type": "beep", "frequency": 950, "duration": 800 },
			"2": { "type": "beep", "frequency": 950, "duration": 800 },
			"1": { "type": "beep", "frequency": 950, "duration": 800 },
			"go": { "type": "voice", "file": "go.mp3" }
		},
		"completion": { "type": "voice", "file": "time.mp3" }
	},
	"timerEvents": {
		"amrap": [
			{ "trigger": { "type": "percentage", "value": 50 }, "action": { "type": "voice", "cue": "halfway" } },
			{ "trigger": { "type": "remainingMs", "value": 60000 }, "action": { "type": "voice", "cue": "one-minute" } },
			{ "trigger": { "type": "remainingMs", "value": 10000 }, "action": { "type": "voice", "cue": "ten-seconds" } },
			{ "trigger": { "type": "remainingMs", "value": 3000 }, "action": { "type": "countdown" } },
			{ "trigger": { "type": "remainingMs", "value": 2000 }, "action": { "type": "countdown" } },
			{ "trigger": { "type": "remainingMs", "value": 1000 }, "action": { "type": "countdown" } }
		],
		"fortime": "amrap",
		"emom": [
			{ "trigger": { "type": "halfwayRounds" }, "action": { "type": "voice", "cue": "half-emom" } },
			{ "trigger": { "type": "beforeRoundEnd", "seconds": 10 }, "action": { "type": "beep", "frequency": 880, "duration": 100 } },
			{ "trigger": { "type": "beforeRoundEnd", "seconds": 3 }, "action": { "type": "countdown" } },
			{ "trigger": { "type": "beforeRoundEnd", "seconds": 2 }, "action": { "type": "countdown" } },
			{ "trigger": { "type": "beforeRoundEnd", "seconds": 1 }, "action": { "type": "countdown" } },
			{ "trigger": { "type": "roundStart", "skipFirst": true }, "action": { "type": "voice", "cue": "next-round" } }
		],
		"tabata": [
			{ "trigger": { "type": "phaseChange", "phase": "work", "skipFirst": true }, "action": { "type": "voice", "cue": "work" } },
			{ "trigger": { "type": "phaseChange", "phase": "rest" }, "action": { "type": "voice", "cue": "rest" } }
		]
	}
}
```

**Step 2: Verify JSON is valid**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && cat src/lib/config/audio-config.json | jq .`
Expected: Pretty-printed JSON without errors

**Step 3: Commit**

```bash
git add src/lib/config/audio-config.json
git commit -m "feat(audio): restructure config for event-driven audio system"
```

---

### Task 3: Create AudioEventManager

**Files:**
- Create: `src/lib/services/audio-events.svelte.ts`

**Step 1: Create the AudioEventManager file**

Create `src/lib/services/audio-events.svelte.ts` with:

```typescript
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
				this.executeAction(event.action, ctx);
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

	private executeAction(action: EventAction, ctx: AudioCheckContext): void {
		switch (action.type) {
			case 'voice':
				audioService.playVoiceCue(action.cue);
				break;

			case 'beep':
				audioService.playBeep(action.frequency, action.duration);
				break;

			case 'countdown': {
				// Determine which countdown value based on remaining time
				const remainingMs = ctx.totalMs - ctx.currentMs;
				let countdownValue: 3 | 2 | 1 | null = null;

				if (remainingMs <= 3000 && remainingMs > 2000) countdownValue = 3;
				else if (remainingMs <= 2000 && remainingMs > 1000) countdownValue = 2;
				else if (remainingMs <= 1000 && remainingMs > 0) countdownValue = 1;

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
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/services/audio-events.svelte.ts
git commit -m "feat(audio): add AudioEventManager for config-driven events"
```

---

### Task 4: Update TimerStore to Use AudioEventManager

**Files:**
- Modify: `src/lib/stores/timer.svelte.ts`

**Step 1: Add import for audioEventManager**

Add after the audioService import (line 10):

```typescript
import { audioEventManager } from '$lib/services/audio-events.svelte';
```

**Step 2: Update initialize method to call audioEventManager.initialize**

In the `initialize` method, add after `this.reset();` (around line 86):

```typescript
audioEventManager.initialize(config.type);
```

**Step 3: Update reset method to call audioEventManager.reset**

In the `reset` method, replace `this.playedEvents.clear();` with:

```typescript
audioEventManager.reset();
```

**Step 4: Add helper methods for round timing**

Add before the `private handleTick` method:

```typescript
private getRoundElapsedMs(): number {
	if (!this.config) return 0;

	switch (this.config.type) {
		case 'emom': {
			const intervalMs = this.config.intervalWork! * 1000;
			return this.elapsedMs % intervalMs;
		}
		case 'tabata': {
			const workMs = this.config.intervalWork! * 1000;
			const restMs = this.config.intervalRest! * 1000;
			const cycleMs = workMs + restMs;
			return this.elapsedMs % cycleMs;
		}
		default:
			return this.elapsedMs;
	}
}

private getRoundDurationMs(): number {
	if (!this.config) return 0;

	switch (this.config.type) {
		case 'emom':
			return this.config.intervalWork! * 1000;
		case 'tabata':
			return this.isWorkPhase
				? this.config.intervalWork! * 1000
				: this.config.intervalRest! * 1000;
		default:
			return this.totalDurationMs;
	}
}
```

**Step 5: Rewrite handleTick to use audioEventManager**

Replace the entire `handleTick` method with:

```typescript
private handleTick(deltaMs: number) {
	if (!this.config) return;

	const prevElapsedMs = this.elapsedMs;
	const prevRound = this.currentRound;
	const prevPhase = this.isWorkPhase;

	this.elapsedMs += deltaMs;

	// Check for completion
	if (this.elapsedMs >= this.totalDurationMs) {
		this.elapsedMs = this.totalDurationMs;
		this.stop();
		return;
	}

	// Handle round/phase transitions
	switch (this.config.type) {
		case 'emom': {
			const intervalMs = this.config.intervalWork! * 1000;
			const newRound = Math.floor(this.elapsedMs / intervalMs) + 1;
			if (newRound !== this.currentRound && newRound <= this.config.rounds!) {
				this.currentRound = newRound;
			}
			break;
		}
		case 'tabata': {
			const workMs = this.config.intervalWork! * 1000;
			const restMs = this.config.intervalRest! * 1000;
			const cycleMs = workMs + restMs;
			const newRound = Math.floor(this.elapsedMs / cycleMs) + 1;
			const elapsedInCycle = this.elapsedMs % cycleMs;
			this.isWorkPhase = elapsedInCycle < workMs;

			if (newRound !== this.currentRound && newRound <= this.config.rounds!) {
				this.currentRound = newRound;
			}
			break;
		}
	}

	// Check audio events via event manager
	audioEventManager.check({
		prevMs: prevElapsedMs,
		currentMs: this.elapsedMs,
		totalMs: this.totalDurationMs,
		currentRound: this.currentRound,
		totalRounds: this.totalRounds,
		roundChanged: this.currentRound !== prevRound,
		isWorkPhase: this.isWorkPhase,
		phaseChanged: this.isWorkPhase !== prevPhase,
		roundElapsedMs: this.getRoundElapsedMs(),
		roundDurationMs: this.getRoundDurationMs()
	});
}
```

**Step 6: Remove old audio methods**

Delete the following methods entirely:
- `checkAudioEvents` (lines ~196-212)
- `checkEmomAudio` (lines ~214-284)
- `checkAmrapForTimeAudio` (lines ~286-324)
- `checkTabataAudio` (lines ~326-352)
- `crossedThreshold` (lines ~354-357)
- `playOnce` (lines ~359-364)

**Step 7: Remove playedEvents field**

Delete the line:
```typescript
private playedEvents = new Set<string>(); // Track played audio events
```

**Step 8: Verify TypeScript compiles**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check`
Expected: No type errors

**Step 9: Commit**

```bash
git add src/lib/stores/timer.svelte.ts
git commit -m "refactor(timer): use AudioEventManager instead of inline audio logic"
```

---

### Task 5: Manual Testing

**Step 1: Start the dev server**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run dev`
Expected: Server starts without errors

**Step 2: Test AMRAP timer**

- Create an AMRAP timer (2 minutes)
- Start timer, verify: 3-2-1 beeps, "GO" voice
- Wait for halfway point, verify: "halfway" voice
- Wait for 1 minute remaining, verify: "one-minute" voice
- Wait for 10 seconds remaining, verify: "ten-seconds" voice
- Wait for final 3-2-1 countdown beeps
- Verify: "time" voice at completion

**Step 3: Test EMOM timer**

- Create an EMOM timer (3 rounds, 1 minute each)
- Start timer, verify: 3-2-1 beeps, "GO" voice
- At 50 seconds in round: verify warning beep
- At 57-58-59 seconds: verify 3-2-1 countdown beeps
- At round transition: verify "next-round" voice
- At halfway through rounds: verify "half-emom" voice
- Verify completion

**Step 4: Test TABATA timer**

- Create a TABATA timer (3 rounds, 20s work / 10s rest)
- Start timer, verify: 3-2-1 beeps, "GO" voice
- At work->rest transition: verify "rest" voice
- At rest->work transition (round 2+): verify "work" voice
- Verify completion

**Step 5: Test mute functionality**

- Start any timer
- Click mute button
- Verify no audio plays while muted
- Click unmute
- Verify audio resumes

**Step 6: Test pause/resume**

- Start any timer
- Pause before a checkpoint
- Resume
- Verify checkpoint audio plays only once (not duplicated)

**Step 7: Commit final verification**

```bash
git add -A
git commit -m "test: verify audio event manager implementation"
```

---

### Task 6: Final Cleanup

**Step 1: Remove unused types from audio.ts (if any)**

Check if these types are still needed:
- `CheckpointConfig` - remove if unused
- `ScheduledCheckpoint` - remove if unused

**Step 2: Verify build passes**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run build`
Expected: Build completes without errors

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore(audio): remove unused legacy types"
```
