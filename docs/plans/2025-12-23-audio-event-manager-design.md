# Audio Event Manager Design

## Overview

Refactor the audio event system to be config-driven and extensible. Extract audio logic from TimerStore into a dedicated AudioEventManager that reads event definitions from JSON config.

## Goals

- Add new audio cues by editing config only (no code changes)
- Single responsibility: TimerStore handles timer logic, AudioEventManager handles audio events
- Type-safe event definitions with TypeScript discriminated unions
- Support time-based and round-based triggers

## Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Event definition | Config-only | Most extensible, minimal overhead for new cues |
| Trigger types | Time + Round-based | Covers all current use cases (EMOM/TABATA) |
| Config structure | Flat event list per type | Simple, easy to read, explicit over implicit |
| Countdown sequence | Keep separate | Startup is different from running events |
| Trigger syntax | Explicit objects | Self-documenting, TypeScript-friendly |
| File location | services/audio-events.svelte.ts | Groups audio code together |
| Integration | Timer calls event manager | Simple, explicit, testable |

## Config Structure

```json
{
  "universal": {
    "countdown": {
      "3": { "type": "beep", "frequency": 950, "duration": 800 },
      "2": { "type": "beep", "frequency": 950, "duration": 800 },
      "1": { "type": "beep", "frequency": 950, "duration": 800 },
      "go": { "type": "voice", "cue": "go" }
    },
    "completion": { "type": "voice", "cue": "time" }
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

## TypeScript Types

```typescript
// Trigger types
export type EventTrigger =
  | { type: 'percentage'; value: number }
  | { type: 'remainingMs'; value: number }
  | { type: 'roundStart'; skipFirst?: boolean }
  | { type: 'roundEnd'; skipLast?: boolean }
  | { type: 'beforeRoundEnd'; seconds: number }
  | { type: 'phaseChange'; phase: 'work' | 'rest'; skipFirst?: boolean }
  | { type: 'halfwayRounds' }

// Action types
export type EventAction =
  | { type: 'voice'; cue: VoiceCueType }
  | { type: 'beep'; frequency: number; duration: number }
  | { type: 'countdown' }

// Audio event
export interface AudioEvent {
  trigger: EventTrigger;
  action: EventAction;
}

// Context passed to event manager
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

## File Changes

### New Files
- `src/lib/services/audio-events.svelte.ts` - AudioEventManager class

### Modified Files
- `src/lib/types/audio.ts` - Add new types
- `src/lib/config/audio-config.json` - Restructure to new format
- `src/lib/stores/timer.svelte.ts` - Remove audio logic, add event manager calls

### Unchanged Files
- `src/lib/services/audio.svelte.ts` - Low-level playback unchanged
- `src/lib/services/timer-engine.ts` - No changes needed

## Testing Checklist

- [ ] AMRAP: halfway, one-minute, ten-seconds, 3-2-1 countdown
- [ ] FOR TIME: same as AMRAP
- [ ] EMOM: round warning beep, countdown, "next round" voice, halfway rounds
- [ ] TABATA: work/rest phase announcements
- [ ] Mute button works
- [ ] Pause/resume doesn't replay events
- [ ] Timer completion plays "time" voice
