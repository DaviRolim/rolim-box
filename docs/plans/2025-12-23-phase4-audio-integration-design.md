# Phase 4: Audio Integration Design

**Date**: December 23, 2025
**Status**: Ready for Implementation
**Dependency**: Phase 3 Timer System (Complete)

---

## Overview

Implement the audio cue system for RolimBox timers with precise Web Audio API scheduling, hybrid voice/beep approach, and offline-capable audio playback.

### Design Decisions Summary

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Audio approach | Hybrid (voice + beeps) | Professional feel at key moments, crisp transitions |
| Voice cue source | TTS-generated | Fast iteration, easy to modify, upgrade path to pro audio |
| File storage | Static assets `/static/audio/` | PWA offline reliability, service worker caching |
| Configuration | JSON config file | Easy to modify checkpoints without code changes |
| Scheduling | Web Audio API | Precise timing required for countdown beeps |
| Pause/resume | Cancel and reschedule | Clean mental model, no stale scheduling issues |
| Beeps | Programmatic oscillators | Zero file overhead, customizable, cuts through gym noise |
| Mute persistence | Session-only | Defaults to audio ON each session (safer for coaches) |
| Preloading | On app load (deferred) | Instant playback, no render blocking |

---

## Architecture

### File Structure

```
src/lib/
├── services/
│   └── audio.ts                    # Core audio service
├── config/
│   └── audio-config.json           # Checkpoint → audio mapping
└── types/
    └── audio.ts                    # Audio type definitions

static/audio/
└── voice/
    ├── go.mp3
    ├── halfway.mp3
    ├── one-minute.mp3
    ├── thirty-seconds.mp3
    ├── ten-seconds.mp3
    ├── time.mp3
    ├── next-round.mp3
    ├── work.mp3
    └── rest.mp3
```

### Audio Service API

```typescript
// Singleton service with reactive state
export const audioService = {
  // Lifecycle
  preload(): Promise<void>        // Load all audio buffers (called on app init)

  // Scheduling
  scheduleForTimer(config: TimerConfig, startTime: number): void
  cancelAll(): void               // Cancel scheduled audio (on pause/reset)
  reschedule(remainingMs: number): void  // Recalculate and schedule (on resume)

  // Immediate playback
  playCountdownBeep(value: 3 | 2 | 1): void
  playVoiceCue(cue: VoiceCueType): void

  // Controls
  mute(): void
  unmute(): void
  toggleMute(): void
  isMuted: boolean                // Reactive state
}
```

---

## JSON Configuration Format

**File: `src/lib/config/audio-config.json`**

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

### Configuration Notes

- `universal` checkpoints apply to all timer types
- `halfway` is calculated dynamically (50% of total duration)
- Timer-specific sections (`emom`, `tabata`) extend universal cues
- Beeps define `frequency` (Hz) and `duration` (ms)
- Voice cues reference files in `/static/audio/voice/`

---

## Web Audio Implementation

### AudioContext Management

- Single `AudioContext` instance created on first user interaction (browser autoplay policy)
- Resume context if suspended (browsers suspend until user gesture)
- Lazy initialization: create on first `preload()` call triggered after app render

### Voice Cue Playback

```typescript
// Preloaded AudioBuffers stored in Map
const buffers: Map<string, AudioBuffer>

// Scheduled playback using AudioBufferSourceNode
function scheduleVoiceCue(cue: string, atTime: number) {
  const source = audioContext.createBufferSource()
  source.buffer = buffers.get(cue)
  source.connect(audioContext.destination)
  source.start(atTime)  // Web Audio timestamp
  scheduledNodes.push(source)  // Track for cancellation
}
```

### Programmatic Beeps

```typescript
function scheduleBeep(frequency: number, duration: number, atTime: number) {
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  // Fade out to avoid click
  gainNode.gain.setValueAtTime(0.5, atTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, atTime + duration/1000)

  oscillator.start(atTime)
  oscillator.stop(atTime + duration/1000)
  scheduledNodes.push(oscillator)
}
```

### Cancellation

```typescript
function cancelAll() {
  scheduledNodes.forEach(node => {
    try { node.stop() } catch {}  // May already be stopped
  })
  scheduledNodes = []
}
```

---

## Checkpoint Scheduling Logic

### Scheduling Flow

```typescript
function scheduleForTimer(config: TimerConfig, audioContextStartTime: number) {
  const checkpoints = calculateCheckpoints(config)

  for (const checkpoint of checkpoints) {
    const playAtTime = audioContextStartTime + (checkpoint.triggerMs / 1000)

    if (checkpoint.type === 'beep') {
      scheduleBeep(checkpoint.frequency, checkpoint.duration, playAtTime)
    } else {
      scheduleVoiceCue(checkpoint.file, playAtTime)
    }
  }
}
```

### Checkpoint Calculation Per Timer Type

| Timer | Total Duration | Checkpoints |
|-------|---------------|-------------|
| **AMRAP** | `duration` minutes | halfway, 1min, 30s, 10s, completion |
| **FOR TIME** | `timeCap` minutes | halfway, 1min, 30s, 10s, completion |
| **EMOM** | `rounds × interval` | halfway, 1min, 30s, 10s, completion + round transitions |
| **TABATA** | `rounds × (work + rest)` | halfway, 1min, 30s, 10s, completion + work/rest phase changes |

### Dynamic Checkpoint Filtering

- Skip checkpoints that exceed timer duration (e.g., no "1 minute remaining" for a 45-second TABATA)
- Calculate "halfway" dynamically: `totalDurationMs / 2`
- For EMOM/TABATA: schedule round/phase cues at each transition point

### Reschedule on Resume

```typescript
function reschedule(remainingMs: number) {
  cancelAll()
  // Recalculate which checkpoints are still ahead
  const futureCheckpoints = checkpoints.filter(cp => cp.remainingMs < remainingMs)
  // Schedule from current audioContext.currentTime
  scheduleCheckpoints(futureCheckpoints, audioContext.currentTime)
}
```

---

## Timer Integration Points

### Modifications to Existing Code

**1. Timer Store (`src/lib/stores/timer.svelte.ts`):**
- Call `audioService.scheduleForTimer()` when transitioning to `running` state
- Call `audioService.cancelAll()` on pause/reset/stop
- Call `audioService.reschedule()` on resume with current `remainingMs`

**2. Countdown Sequence (store or component):**
- Trigger `audioService.playCountdownBeep(3)`, `playCountdownBeep(2)`, `playCountdownBeep(1)` during countdown
- Trigger `audioService.playVoiceCue('go')` when countdown completes

**3. Timer Display (`TimerDisplay.svelte`):**
- Connect mute button to `audioService.toggleMute()`
- Bind mute icon state to `audioService.isMuted`

**4. App Initialization (`+layout.svelte` or root):**
- Call `audioService.preload()` after initial render using `onMount` + `requestIdleCallback`

### Event Flow

```
User clicks Start
  → Countdown begins (3-2-1-Go with beeps/voice)
  → State transitions to 'running'
  → audioService.scheduleForTimer() calculates all checkpoints
  → Web Audio schedules playback at precise times
  → User pauses → audioService.cancelAll()
  → User resumes → audioService.reschedule(remainingMs)
  → Timer completes → "Time!" plays (already scheduled)
```

---

## Audio Files

### TTS Voice Cues to Generate

| File | Text | Notes |
|------|------|-------|
| `go.mp3` | "Go!" | Energetic, motivational |
| `halfway.mp3` | "Halfway!" | Encouraging |
| `one-minute.mp3` | "One minute!" | Alert tone |
| `thirty-seconds.mp3` | "Thirty seconds!" | Urgency building |
| `ten-seconds.mp3` | "Ten seconds!" | High urgency |
| `time.mp3` | "Time!" | Completion, triumphant |
| `next-round.mp3` | "Next round!" | EMOM transitions |
| `work.mp3` | "Work!" | TABATA work phase |
| `rest.mp3` | "Rest!" | TABATA rest phase |

### Generation Recommendations

- Use ElevenLabs or Amazon Polly for natural-sounding voice
- Choose an energetic, coach-like voice
- Keep clips short (under 1 second each)
- Export as MP3 at 128kbps (balance of quality and size)
- Estimated total size: ~200-400KB

---

## Service Worker Caching

Update service worker to precache audio files:

```typescript
const AUDIO_ASSETS = [
  '/audio/voice/go.mp3',
  '/audio/voice/halfway.mp3',
  '/audio/voice/one-minute.mp3',
  '/audio/voice/thirty-seconds.mp3',
  '/audio/voice/ten-seconds.mp3',
  '/audio/voice/time.mp3',
  '/audio/voice/next-round.mp3',
  '/audio/voice/work.mp3',
  '/audio/voice/rest.mp3'
]
```

---

## Mute Controls

### UI Integration

- Mute button already exists as placeholder in `TimerDisplay.svelte` header
- Toggle between muted/unmuted icons
- Visual indicator visible at all times during timer

### State Management

```typescript
// In audio service
let isMuted = $state(false)

function toggleMute() {
  isMuted = !isMuted
}

// When scheduling/playing, check isMuted first
function playVoiceCue(cue: string) {
  if (isMuted) return
  // ... play audio
}
```

---

## Browser Compatibility Considerations

### Autoplay Policy

- AudioContext starts in "suspended" state until user interaction
- First timer start (user click) resumes the context
- Preloading can happen before interaction (just loads buffers)

### Wake Lock + Audio

- Wake Lock API already implemented in Phase 3
- Audio continues playing with screen wake lock active
- No additional handling needed

### Fallbacks

- If Web Audio API unavailable (rare), gracefully degrade to no audio
- Log warning but don't break timer functionality

---

## Implementation Order

1. Create audio type definitions
2. Create JSON configuration file
3. Implement audio service (preload, scheduling, playback)
4. Generate TTS audio files
5. Integrate with timer store (schedule on start, cancel on pause)
6. Add countdown beeps to countdown sequence
7. Connect mute button in TimerDisplay
8. Add deferred preloading to app initialization
9. Update service worker for audio caching
10. Test all timer types with audio

---

## Success Criteria

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
