# Product Requirements Document: RolimBox

## 1. Product Overview

### 1.1 Product Name

RolimBox - CrossFit Workout Management & Timer System

### 1.2 Product Vision

A web-based Progressive Web App (PWA) designed for CrossFit box owners and coaches to efficiently create, manage, and execute daily workouts with intelligent timer systems and audio coaching cues.

### 1.3 Target Users (MVP)

- CrossFit box owners
- CrossFit coaches
- Single-user accounts (multi-user support post-MVP)

### 1.4 Platform

Web application (PWA) with:

- Mobile-first responsive design
- Installable to home screen
- Offline capability
- Fullscreen mode support
- Screen wake lock for timers

---

## 2. Core Features (MVP Scope)

### 2.1 Workout of the Day (WoD) Management

#### 2.1.1 WoD Structure

Each WoD consists of:

- **Date**: Auto-assigned (editable)
- **General Description**: Free-form text for workout focus/theme
- **Sections**: Flexible, user-defined workout segments

#### 2.1.2 Section Management

- **Predefined Section Types**: Warmup, Skill, WoD, Cool-down, Stretches
- **Custom Sections**: Coaches can create custom-named sections
- **Section Content**:
  - Free-form text/description
  - Optional timer attachment
- **Add/Remove/Reorder**: Sections can be dynamically managed

#### 2.1.3 WoD Creation Flow

1. Coach creates new WoD (auto-dated to current day)
2. Adds general workout description
3. Adds sections (from presets or custom)
4. Fills in section content
5. Optionally attaches timers to sections
6. Explicitly saves WoD

#### 2.1.4 WoD Actions

- **Create**: New WoD from scratch
- **Save**: Explicit save button (no auto-save)
- **Edit**: Modify existing WoD
- **Duplicate**: Create new day's WoD from previous workout
- **Delete**: Remove WoD from library
- **Date Edit**: Change workout date (for planning ahead or backfilling)

### 2.2 Timer System

#### 2.2.1 Timer Types & Configurations

**AMRAP (As Many Rounds As Possible)**

- Configuration: Total duration (minutes)
- Default: 20 minutes
- Behavior: Counts down from set duration
- Display: Large countdown timer

**EMOM (Every Minute On the Minute)**

- Configuration: Number of rounds, interval duration
- Default: 10 rounds x 1 minute
- Behavior: Counts down each interval, advances to next round
- Display: Current round number + interval countdown

**FOR TIME**

- Configuration: Time cap (minutes)
- Default: 15 minutes
- Behavior: Counts up until manual completion or time cap reached
- Display: Elapsed time (count-up)

**TABATA**

- Configuration: Work interval, rest interval, number of rounds
- Default: 20s work / 10s rest x 8 rounds
- Behavior: Alternates work/rest intervals
- Display: Current interval type (WORK/REST), round number, countdown

#### 2.2.2 Timer Usage Modes

**Standalone Timer Mode**

- Launch timer independently without WoD
- Quick access for impromptu timing needs
- Configuration screen → Timer display

**WoD-Attached Timer Mode**

- Timer linked to specific WoD section
- Start button within section context
- Displays section name and movements alongside timer

#### 2.2.3 Timer Display & Controls

**Display Requirements**

- **Fullscreen Mode**: Hide browser UI
- **Screen Wake Lock**: Prevent device sleep
- **Large Timer Display**: Primary visual focus (high contrast)
- **Section Context** (when attached to WoD):
  - Section name (e.g., "WoD - 20min AMRAP")
  - Movement description (secondary, doesn't obstruct timer)
- **Standalone Mode**: Timer only

**Playback Controls**

- Start/Pause button
- Reset button (return to initial state)
- Stop/Finish Early button
- Mute/Unmute toggle for audio cues
- Exit fullscreen

#### 2.2.4 Audio Cue System

**Universal Audio Checkpoints**

- Workout start: "3, 2, 1, Go!"
- Halfway point
- 1 minute remaining
- 30 seconds remaining
- 10 seconds remaining
- Completion: "Time!" / "Stop!"

**Timer-Specific Audio Cues**

- **EMOM**: "Next round" at interval transitions, "5 seconds to next round"
- **TABATA**: "Work" / "Rest" at interval changes
- **AMRAP**: Standard checkpoints
- **FOR TIME**: Standard checkpoints

**Audio Implementation**

- Pre-recorded audio files (coach's voice)
- Audio library mapped to specific timestamps
- Architected for easy audio file swapping
- Future: Custom coach recordings per checkpoint (post-MVP)

**Audio Controls**

- Mute toggle during workout
- Relies on device volume for level control

### 2.3 Workout Library & History

#### 2.3.1 Display

- Chronological list (most recent first)
- Each entry shows:
  - Date
  - Workout title/description preview
  - Quick actions (View, Edit, Duplicate, Delete)

#### 2.3.2 Actions

- **View**: See full WoD details
- **Edit**: Modify existing WoD
- **Duplicate**: Create new WoD from template (assigns new date)
- **Delete**: Remove from library (with confirmation)

#### 2.3.3 Data Management

- All workouts stored locally (IndexedDB/LocalStorage)
- Cloud sync for backup and cross-device access
- Offline-first: full functionality without internet
- Sync when connection available

---

## 3. User Flows

### 3.1 Primary Flow: Create & Execute WoD

```
1. Coach arrives at box, opens RolimBox PWA
2. Creates new WoD (auto-dated to today)
3. Adds general description: "Focus on snatches and aerobic capacity"
4. Adds sections:
   - Stretches (preset) → adds text content
   - Warmup (preset) → adds text content
   - Skill (preset) → adds text content + attaches 10min EMOM timer
   - WoD (preset) → adds text content + attaches 20min AMRAP timer
5. Saves WoD
6. During class:
   - Opens WoD
   - Navigates to Skill section, starts EMOM timer
   - Fullscreen timer with audio cues plays
   - After completion, moves to WoD section
   - Starts AMRAP timer with movements visible
   - Uses mute toggle when giving instructions
   - Timer completes, class finishes
```

### 3.2 Secondary Flow: Standalone Timer

```
1. Coach needs quick timer for unplanned drill
2. Navigates to Timer section
3. Selects TABATA
4. Configures: 30s work / 15s rest / 6 rounds
5. Starts timer → fullscreen display
6. Audio cues guide intervals
7. Finishes or stops early as needed
```

### 3.3 Tertiary Flow: Reuse Previous WoD

```
1. Coach opens Workout Library
2. Scrolls chronological list, finds "Snatch Complex - Nov 15"
3. Selects Duplicate
4. System creates new WoD with today's date
5. Coach edits description/sections as needed
6. Saves
7. Executes as normal
```

---

## 4. Technical Requirements

### 4.1 Platform & Architecture

- **Type**: Progressive Web App (PWA)
- **Framework**: Sveltekit
- **Styling**: Tailwind CSS (recommended for rapid development)
- **State Management**: Svelte 5 state management
- **Routing**: Sveltekit routing pattern

### 4.2 Data Persistence

- **Local Storage**: IndexedDB for workout library
- **Cloud Backend**: Firebase/Supabase for sync and backup
- **Offline Support**: Service workers for offline functionality
- **Sync Strategy**:
  - Read-local-first
  - Write to local immediately
  - Background sync to cloud when online

### 4.3 PWA Capabilities

- **Manifest**: App name, icons, theme colors (dark purple/pink)
- **Service Worker**: Cache assets and workout data
- **Installability**: Add to home screen prompt
- **Fullscreen**: Display mode for timer views
- **Wake Lock API**: Prevent screen sleep during timers

### 4.4 Audio System

- **Web Audio API**: Precise timing and playback
- **Audio Files**: Pre-recorded MP3/WAV files
- **Audio Mapping**: JSON configuration mapping checkpoints to files
- **Preloading**: Load audio files before timer starts
- **Architecture**: Modular audio service for easy file swapping

### 4.5 Authentication (MVP)

- **Single User**: Email/password authentication
- **Provider**: Lucia, saving on Turso db (sqlite)
- **Session**: Persistent login
- **Future**: Multi-user with team/organization support

### 4.6 Responsive Design

- **Mobile-first**: Optimized for phone/tablet creation
- **Large Display**: Timer mode optimized for mobile/TV/monitor display
- **Breakpoints**: Mobile, tablet, desktop, large screen

---

## 5. Design Requirements

### 5.1 Branding

- **Name**: RolimBox
- **Color Palette**:
  - Primary: Dark purple (#2D1B4E, #4A2C6F)
  - Secondary: Black (#000000, #0A0A0A)
  - Accents: Light purple (#8B7AB8), Pinkish (#E91E8C, #FF6B9D)
- **Theme**: Dark mode with high contrast
- **Typography**: Bold, athletic, readable at distance

### 5.2 UI Principles

- **Minimalist**: Clean interface, focused on functionality
- **High Contrast**: Ensure visibility in gym lighting conditions
- **Large Touch Targets**: Easy interaction during workouts
- **Fast Navigation**: Minimal clicks to start timer
- **Clear Hierarchy**: Timer always primary visual element

### 5.3 Key Screens

**Dashboard/Home**

- Quick access to: Create WoD, Standalone Timer, Workout Library
- Today's WoD preview (if exists)
- Recent workouts list

**WoD Creation/Edit**

- General description text area
- Section management (add/remove/reorder)
- Section content editor
- Timer attachment interface
- Save/Cancel buttons

**Timer Configuration**

- Timer type selector (AMRAP/EMOM/FOR TIME/TABATA)
- Configuration inputs with defaults
- Start button

**Timer Display (Fullscreen)**

- Massive timer display (70% of screen)
- Section context (if attached): name + movements (20% of screen)
- Controls (bottom): Pause/Reset/Stop/Mute (10% of screen)
- Dark background, high-contrast timer text
- Progress indicator (optional)

**Workout Library**

- Chronological list
- Date + preview
- Action buttons per entry
- Search/filter (post-MVP)

---

## 6. Success Metrics (MVP)

### 6.1 Adoption Metrics

- Number of registered coaches
- Number of WoDs created per week
- Number of timers started per week

### 6.2 Engagement Metrics

- Daily active users
- Average WoDs created per coach
- Library reuse rate (duplicated workouts)

### 6.3 Technical Metrics

- PWA installation rate
- Offline usage rate
- Timer completion rate vs. early stops
- Audio cue playback success rate

---

## 7. Out of Scope (Post-MVP)

### 7.1 Features Explicitly Deferred

- Multi-user/team accounts
- Custom coach audio recording
- Athlete-facing view/app
- Workout analytics and tracking
- Exercise library/database
- Video demonstrations
- Social features (sharing workouts)
- Advanced search/filtering in library
- Workout templates/programming tools
- Integration with other platforms
- Payment/subscription system
- White-label/multi-box support

### 7.2 Future Considerations

- Mobile native apps (iOS/Android) if demand requires
- Advanced timer types (custom intervals, complex combinations)
- Workout performance tracking for athletes
- Leaderboards
- API for third-party integrations

---

## 8. Development Phases

### Phase 1: Core Infrastructure (Week 1-2)

- Set up PWA foundation
- Authentication system
- Basic data models and local storage
- Cloud sync setup

### Phase 2: WoD Management (Week 3-4)

- WoD creation interface
- Section management
- Save/edit/delete functionality
- Workout library view

### Phase 3: Timer System (Week 5-6)

- All four timer types implementation
- Timer configuration interface
- Fullscreen timer display
- Basic playback controls

### Phase 4: Audio Integration (Week 7)

- Audio cue system architecture
- Pre-recorded audio integration
- Audio playback timing
- Mute controls

### Phase 5: Polish & Testing (Week 8)

- UI/UX refinement
- PWA optimization
- Offline functionality testing
- Cross-device testing
- Beta testing with RolimBox coaches

---

## 9. Risks & Mitigations

### 9.1 Technical Risks

**Risk**: Audio playback timing imprecision

- **Mitigation**: Use Web Audio API with precise scheduling, pre-load all audio files

**Risk**: Screen sleep during long timers

- **Mitigation**: Implement Wake Lock API with fallback to browser-specific methods

**Risk**: Offline sync conflicts

- **Mitigation**: Last-write-wins strategy for MVP, conflict resolution post-MVP

**Risk**: PWA installation friction

- **Mitigation**: Clear onboarding prompts, "Add to Home Screen" instructions

### 9.2 User Experience Risks

**Risk**: Coaches create WoDs on-the-fly under time pressure

- **Mitigation**: Fast creation flow, defaults for timer configs, section presets

**Risk**: Timer controls too small/difficult during workouts

- **Mitigation**: Large touch targets, simple controls, minimal UI

**Risk**: Audio cues distracting or mistimed

- **Mitigation**: Beta testing with real coaches, adjustable/mutable audio

---

## 10. Appendix

### 10.1 Timer Configuration Details

| Timer Type | Configuration Fields       | Default Values | Notes                           |
| ---------- | -------------------------- | -------------- | ------------------------------- |
| AMRAP      | Duration (minutes)         | 20             | Countdown display               |
| EMOM       | Rounds, Interval (seconds) | 10 rounds, 60s | Shows round # + countdown       |
| FOR TIME   | Time Cap (minutes)         | 15             | Count-up display, manual finish |
| TABATA     | Work (s), Rest (s), Rounds | 20s, 10s, 8    | Alternating intervals           |

### 10.2 Audio Cue Mapping (Initial)

| Checkpoint      | All Timers       | EMOM Specific             | TABATA Specific |
| --------------- | ---------------- | ------------------------- | --------------- |
| Start           | "3, 2, 1, Go!"   | Same                      | Same            |
| Halfway         | "Halfway there!" | N/A                       | N/A             |
| 1 min left      | "1 minute to go" | N/A                       | N/A             |
| 30s left        | "30 seconds!"    | N/A                       | N/A             |
| 10s left        | "10 seconds!"    | "5 seconds to next round" | N/A             |
| Interval change | N/A              | "Next round"              | "Work" / "Rest" |
| Complete        | "Time!"          | "Time!"                   | "Time!"         |

### 10.3 Screen State Diagram

```
[Home Dashboard]
    ├─→ [Create WoD] → [Edit WoD] → [Save] → [WoD View]
    ├─→ [Workout Library] → [Select WoD] → [WoD View]
    ├─→ [Standalone Timer] → [Configure Timer] → [Timer Display]
    └─→ [WoD View] → [Start Section Timer] → [Timer Display]

[Timer Display]
    ├─→ [Pause] ⟷ [Resume]
    ├─→ [Reset] → [Timer Display]
    ├─→ [Stop] → [Previous Screen]
    └─→ [Complete] → [Previous Screen]
```

---

## Document Control

**Version**: 1.0  
**Date**: December 22, 2025  
**Author**: Product Team  
**Status**: Approved for Development  
**Next Review**: Post-MVP Launch
