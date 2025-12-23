# Phase 3: Timer System Design

**Date**: December 22, 2025
**Status**: Approved
**Reference**: [Development Phases Spec](../specs/development_phases_spec.md)

---

## Overview

This document defines the implementation design for the RolimBox Timer System (Phase 3). The timer system provides four CrossFit timer types (AMRAP, EMOM, FOR TIME, TABATA) with fullscreen display, both standalone and WoD-attached modes.

---

## Architecture

### File Structure

```
src/lib/
├── types/
│   └── timer.ts              # Timer types & config schema
├── stores/
│   └── timer.svelte.ts       # Timer state machine (runes)
├── services/
│   └── timer-engine.ts       # Interval/timing logic
├── components/
│   └── timer/
│       ├── TimerDisplay.svelte      # Fullscreen timer view
│       ├── TimerControls.svelte     # Bottom control bar
│       ├── TimerProgress.svelte     # Progress bar
│       ├── TimerConfig.svelte       # Config form (used in tabs & section)
│       ├── CountdownOverlay.svelte  # 3-2-1-Go display
│       └── RoundIndicator.svelte    # Round/interval display
src/routes/(app)/
├── timer/
│   └── +page.svelte          # Standalone timer config page
└── timer/[id]/
    └── +page.svelte          # Fullscreen timer execution
```

### Data Flow

1. User configures timer (standalone or attached to section)
2. Config stored as JSON in `Section.timerConfig` or passed via URL state
3. Timer page initializes `timer.svelte.ts` store with config
4. `timer-engine.ts` handles precise intervals via `setInterval` + drift correction
5. Store state drives reactive UI updates

### Key Principle

Timer engine runs independently of UI rendering. Store acts as the single source of truth. Components subscribe to store state.

---

## Type Definitions

### `src/lib/types/timer.ts`

```typescript
export type TimerType = 'amrap' | 'emom' | 'fortime' | 'tabata';

export type TimerState = 'idle' | 'countdown' | 'running' | 'paused' | 'completed';

export interface TimerConfig {
  type: TimerType;
  duration?: number;      // seconds - AMRAP total, FOR TIME cap
  rounds?: number;        // EMOM & TABATA round count
  intervalWork?: number;  // seconds - EMOM interval, TABATA work
  intervalRest?: number;  // seconds - TABATA rest only
}

export interface TimerContext {
  sectionId?: string;     // When launched from WoD section
  sectionName?: string;   // Display context
  wodId?: string;         // Parent WoD reference
}
```

### Default Configurations

| Type | Defaults |
|------|----------|
| AMRAP | 20 minutes |
| EMOM | 10 rounds x 60 seconds |
| FOR TIME | 15 minute cap |
| TABATA | 8 rounds x 20s work / 10s rest |

### Validation Rules

- **AMRAP**: `duration` required, 1-60 minutes
- **EMOM**: `rounds` (1-50) + `intervalWork` (10-300s) required
- **FOR TIME**: `duration` required as time cap, 1-60 minutes
- **TABATA**: `rounds` (1-20) + `intervalWork` (5-60s) + `intervalRest` (5-60s) required

---

## Timer State Machine

### Store Structure (`src/lib/stores/timer.svelte.ts`)

```typescript
// Core state
let config = $state<TimerConfig | null>(null);
let state = $state<TimerState>('idle');
let elapsedMs = $state(0);           // Total elapsed milliseconds
let currentRound = $state(1);         // Current round (EMOM/TABATA)
let isWorkPhase = $state(true);       // TABATA: work vs rest
let completedRounds = $state(0);      // AMRAP/FOR TIME: manual counter

// Derived values
let totalDurationMs = $derived(/* calculated from config */);
let remainingMs = $derived(/* depends on timer type */);
let progress = $derived(elapsedMs / totalDurationMs);
let displayTime = $derived(/* formatted MM:SS or SS */);
let roundProgress = $derived(/* progress within current round */);
```

### State Transitions

```
idle → countdown     (start)
countdown → running  (after 3-2-1-Go)
running → paused     (pause)
paused → running     (resume)
running → completed  (time reached)
paused → idle        (reset)
running → idle       (stop/cancel)
completed → idle     (reset)
```

### Timer Behavior Per Type

| Type | Direction | Completes When |
|------|-----------|----------------|
| AMRAP | Count DOWN | `remainingMs === 0` |
| EMOM | Count DOWN per round | All rounds complete |
| FOR TIME | Count UP | User stops or cap reached |
| TABATA | Count DOWN per interval | All rounds complete |

---

## Timer Engine

### `src/lib/services/timer-engine.ts`

```typescript
export function createTimerEngine(onTick: (deltaMs: number) => void) {
  let intervalId: number | null = null;
  let lastTickTime: number = 0;

  const TICK_INTERVAL = 100; // 100ms ticks for smooth UI

  function start() {
    lastTickTime = performance.now();
    intervalId = setInterval(() => {
      const now = performance.now();
      const delta = now - lastTickTime;
      lastTickTime = now;
      onTick(delta);
    }, TICK_INTERVAL);
  }

  function stop() { /* clear interval */ }
  function pause() { /* clear interval, preserve state */ }
  function resume() { /* restart with current state */ }

  return { start, stop, pause, resume };
}
```

### Design Decisions

- **100ms tick interval**: Balances UI smoothness vs battery/CPU
- **Delta-based timing**: Uses `performance.now()` to handle drift and tab throttling
- **Separation from store**: Engine pushes deltas, store manages state
- **No Web Workers**: Keeps it simple; `setInterval` is sufficient for this use case

### Edge Cases Handled

- Browser tab goes to background (throttled intervals)
- Device sleep/wake (recalculate on resume)
- Rapid pause/resume clicks (debounced)

---

## Fullscreen Display

### Route: `/timer/[id]`

The `[id]` can be:
- `standalone` - config passed via URL search params
- Section ID - config loaded from IndexedDB

### Display Layout Per Timer Type

**AMRAP Layout:**
```
┌─────────────────────────────────────┐
│  AMRAP                    [mute] x  │
│                                     │
│              12:34                  │  <- Time remaining
│                                     │
│       ROUNDS    ┌─────┐             │
│          5      │  +  │             │  <- Manual round counter
│                 └─────┘             │
│  ━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░  │
├─────────────────────────────────────┤
│   PAUSE       RESET       STOP      │
└─────────────────────────────────────┘
```

**EMOM/TABATA Layout:**
```
┌─────────────────────────────────────┐
│  EMOM                     [mute] x  │
│                                     │
│              00:45                  │  <- Time in current round
│                                     │
│         Round 3 of 10               │  <- Automatic progression
│                                     │
│  ━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░  │
├─────────────────────────────────────┤
│   PAUSE       RESET       STOP      │
└─────────────────────────────────────┘
```

**FOR TIME Layout:**
```
┌─────────────────────────────────────┐
│  FOR TIME (cap: 15:00)    [mute] x  │
│                                     │
│              08:23                  │  <- Time elapsed (counting up)
│                                     │
│       ROUNDS    ┌─────┐             │
│          2      │  +  │             │  <- Optional round counter
│                 └─────┘             │
│  ━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░  │
├─────────────────────────────────────┤
│   PAUSE       RESET       FINISH    │  <- FINISH instead of STOP
└─────────────────────────────────────┘
```

### Fullscreen & Wake Lock

```typescript
async function enterFullscreen(element: HTMLElement) {
  await element.requestFullscreen();

  // Prevent screen sleep
  if ('wakeLock' in navigator) {
    wakeLock = await navigator.wakeLock.request('screen');
  }
}

function exitFullscreen() {
  document.exitFullscreen();
  wakeLock?.release();
}
```

### Styling

- Black background (`#0a0a0a`) for OLED battery savings
- High contrast time display (white or pink accent `#e91e8c`)
- Athletic Brutalism style for controls (skewed buttons, bold type)
- Minimum 120px font size for time, readable at 20+ feet
- Touch targets minimum 44px, round counter button 60px+

---

## Timer Configuration Page

### Route: `/timer`

Single page with type tabs, accessed via Dashboard Quick Actions.

```
┌─────────────────────────────────────┐
│  <- BACK              TIMER         │
├─────────────────────────────────────┤
│  ┌────────┬────────┬────────┬─────┐ │
│  │ AMRAP  │  EMOM  │FOR TIME│TABATA│ │
│  └────────┴────────┴────────┴─────┘ │
├─────────────────────────────────────┤
│                                     │
│  DURATION                           │
│  ┌─────────────────────────────┐    │
│  │  20           minutes       │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │         START TIMER         │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

### Config Fields Per Tab

| Tab | Fields |
|-----|--------|
| AMRAP | Duration (minutes) |
| EMOM | Rounds, Interval (seconds) |
| FOR TIME | Time Cap (minutes) |
| TABATA | Rounds, Work (seconds), Rest (seconds) |

### Dashboard Quick Actions

Add 4 timer buttons to existing grid:
- AMRAP -> `/timer?type=amrap`
- EMOM -> `/timer?type=emom`
- FOR TIME -> `/timer?type=fortime`
- TABATA -> `/timer?type=tabata`

---

## WoD Section Integration

### Section Edit Form

"Add Timer" button expands inline config:

```
┌─────────────────────────────────────┐
│  Section: WoD                       │
│  ┌─────────────────────────────┐    │
│  │ 21-15-9                     │    │
│  │ Thrusters (95/65)           │    │
│  │ Pull-ups                    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  + ADD TIMER                │    │  <- Collapsed
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘

         | After tap |

┌─────────────────────────────────────┐
│  TIMER                      [Remove]│
│  ┌────────┬────────┬────────┬─────┐ │
│  │ AMRAP  │  EMOM  │FOR TIME│TABATA│ │
│  └────────┴────────┴────────┴─────┘ │
│                                     │
│  TIME CAP                           │
│  ┌─────────────────────────────┐    │
│  │  15           minutes       │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### WoD View - Section with Timer

```
┌─────────────────────────────────────┐
│  WoD                                │
│  21-15-9 Thrusters, Pull-ups        │
│                                     │
│  ┌──────────────────────┐           │
│  │  FOR TIME - 15:00    │           │  <- Tappable timer badge
│  └──────────────────────┘           │
└─────────────────────────────────────┘
```

Tapping launches `/timer/[sectionId]` with section context.

### Data Storage

Timer config saved to `Section.timerConfig` as JSON string when WoD is saved.

---

## Countdown Sequence

### 3-2-1-Go Flow

```typescript
let countdownValue = $state<number | 'GO' | null>(null);

async function startCountdown() {
  state = 'countdown';
  for (const val of [3, 2, 1, 'GO']) {
    countdownValue = val;
    await sleep(val === 'GO' ? 500 : 1000);
  }
  countdownValue = null;
  state = 'running';
  engine.start();
}
```

### Visual Design

- Numbers scale up with slight animation (120px -> 150px)
- Pink accent color (`#e91e8c`) for countdown numbers
- "GO!" flashes with background pulse
- Transitions to timer display immediately after

### Phase 4 Audio Hooks

Events emitted for audio integration:
- `onCountdownTick(value)` - for beeps on 3, 2, 1
- `onCountdownComplete()` - for "Go!" sound
- `onTimerTick(remainingMs)` - for checkpoint cues
- `onRoundChange(round)` - for EMOM/TABATA transitions
- `onTimerComplete()` - for "Time!" sound

---

## Implementation Scope

### New Files

| File | Purpose |
|------|---------|
| `src/lib/types/timer.ts` | Type definitions |
| `src/lib/stores/timer.svelte.ts` | State machine |
| `src/lib/services/timer-engine.ts` | Timing logic |
| `src/lib/components/timer/TimerDisplay.svelte` | Main fullscreen view |
| `src/lib/components/timer/TimerControls.svelte` | Bottom control bar |
| `src/lib/components/timer/TimerProgress.svelte` | Progress bar |
| `src/lib/components/timer/TimerConfig.svelte` | Config form |
| `src/lib/components/timer/CountdownOverlay.svelte` | 3-2-1-Go |
| `src/lib/components/timer/RoundIndicator.svelte` | Round display |
| `src/routes/(app)/timer/+page.svelte` | Config page |
| `src/routes/(app)/timer/[id]/+page.svelte` | Execution page |

### Files to Modify

| File | Changes |
|------|---------|
| `src/routes/(app)/dashboard/+page.svelte` | Add timer quick actions |
| `src/lib/components/sections/EditSectionForm.svelte` | Add timer config |
| `src/lib/components/sections/SectionCard.svelte` | Add timer badge |
| `src/routes/(app)/workouts/[id]/+page.svelte` | Timer launch from view |

### Out of Scope (Phase 4)

- Audio cues (hooks prepared)
- Mute toggle functionality (UI placeholder only)

---

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State management | Svelte 5 Runes Store | Matches existing patterns |
| Config structure | Unified object | Simple serialization |
| Fullscreen | Native Fullscreen API | Best gym experience |
| Controls | Bottom control bar | Natural thumb reach |
| Standalone access | Dashboard Quick Actions | Fast coach access |
| Display density | Minimal, time-focused | Gym readability |
| Pre-start countdown | Automatic 3 seconds | CrossFit standard |
| Config UI | Single page with tabs | Quick and clean |
| Section attachment | Inline config | Context preserved |
| AMRAP rounds | Manual + button | Athlete-controlled |

---

## Document Control

**Version**: 1.0
**Approved**: December 22, 2025
**Next Step**: Create detailed implementation plan
