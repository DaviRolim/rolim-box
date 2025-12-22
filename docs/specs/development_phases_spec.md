# RolimBox Development Phases Specification

**Reference**: [PRD v1.0](../prds/project_prd.md)
**Target Audience**: Senior Software Engineers
**Purpose**: High-level phase breakdown for implementation planning

---

## Overview

RolimBox is a PWA for CrossFit workout management with timer systems and audio cues. This spec defines five development phases, each to be expanded into detailed implementation plans.

### Tech Stack Summary
- **Framework**: SvelteKit + Svelte 5
- **Styling**: Tailwind CSS
- **Auth**: Lucia + Turso (SQLite)
- **Local Storage**: IndexedDB
- **Cloud Sync**: Firebase/Supabase
- **Audio**: Web Audio API

---

## Phase 1: Core Infrastructure

### Objective
Establish the foundational architecture: PWA setup, authentication, data layer, and cloud sync infrastructure.

### Scope

**PWA Foundation**
- SvelteKit project scaffolding with Svelte 5
- PWA manifest configuration (name, icons, theme colors: dark purple/pink palette)
- Service worker setup for asset caching
- Responsive layout shell (mobile-first)

**Authentication System**
- Lucia auth integration with Turso database
- Email/password authentication flow
- Session management and persistence
- Protected route middleware

**Data Layer**
- IndexedDB schema design for workouts
- Data models: WoD, Section, Timer configurations
- Local CRUD operations abstraction
- Offline-first read/write patterns

**Cloud Sync Infrastructure**
- Firebase/Supabase project setup
- Sync service architecture (background sync strategy)
- Conflict resolution approach (last-write-wins for MVP)
- Online/offline state detection

### Key Deliverables
- Authenticated PWA shell installable to home screen
- Working local data persistence
- Cloud sync operational (even if minimal data)

### Dependencies
- None (foundational phase)

### Risks to Address
- PWA installation friction across browsers
- Offline sync conflict edge cases

---

## Phase 2: WoD Management

### Objective
Implement the complete WoD creation, editing, and library management system.

### Scope

**WoD Data Structure**
- WoD entity: date, description, sections array
- Section entity: type, name, content, timer reference (optional)
- Predefined section types: Warmup, Skill, WoD, Cool-down, Stretches
- Custom section support

**WoD Creation Interface**
- Create new WoD (auto-dated to current day)
- General description editor
- Date picker for editing/scheduling
- Explicit save action (no auto-save)

**Section Management**
- Add sections from presets or custom
- Remove sections
- Reorder sections (drag-and-drop or move up/down)
- Section content editor (free-form text)
- Timer attachment UI (placeholder for Phase 3 integration)

**Workout Library**
- Chronological list view (most recent first)
- Entry display: date, description preview
- Actions: View, Edit, Duplicate, Delete
- Delete confirmation dialog
- Duplicate functionality (assigns new date)

**WoD View Screen**
- Full workout display with all sections
- Navigation to edit mode
- Section timer launch points (placeholder for Phase 3)

### Key Deliverables
- Full WoD CRUD operations
- Workout library with all actions
- Data persisting to IndexedDB and syncing to cloud

### Dependencies
- Phase 1: Auth, data layer, sync infrastructure

### Risks to Address
- Fast creation flow for time-pressured coaches
- Section reordering UX on mobile

---

## Phase 3: Timer System

### Objective
Implement all four timer types with fullscreen display, playback controls, and both standalone and WoD-attached modes.

### Scope

**Timer Types Implementation**
- AMRAP: Countdown from configured duration (default: 20 min)
- EMOM: Round-based intervals (default: 10 rounds × 60s)
- FOR TIME: Count-up with time cap (default: 15 min cap)
- TABATA: Work/rest alternating intervals (default: 20s/10s × 8 rounds)

**Timer State Machine**
- States: idle, countdown (3-2-1), running, paused, completed
- Time tracking with precision (milliseconds internally, seconds displayed)
- Round/interval tracking for EMOM and TABATA
- Progress calculation for all timer types

**Timer Configuration Interface**
- Timer type selector
- Type-specific configuration inputs
- Default values pre-populated
- Validation for inputs

**Fullscreen Timer Display**
- Fullscreen API integration
- Wake Lock API implementation (prevent screen sleep)
- Large timer display (high contrast, readable at distance)
- Round/interval indicators where applicable
- Progress visualization

**Timer Controls**
- Start/Pause toggle
- Reset to initial state
- Stop/Finish early
- Exit fullscreen

**Timer Usage Modes**
- Standalone mode: Direct timer access from dashboard
- WoD-attached mode: Timer linked to section, displays section context
- Section name and movement description overlay (non-obstructive)

**Phase 2 Integration**
- Timer attachment to WoD sections
- Launch timer from WoD view
- Timer configuration stored with section

### Key Deliverables
- All four timer types fully functional
- Standalone and WoD-attached modes
- Fullscreen display with wake lock
- Complete playback controls

### Dependencies
- Phase 2: WoD section structure for attached timer mode

### Risks to Address
- Wake Lock API browser support and fallbacks
- Timer precision across device sleep/wake cycles
- Large touch targets for mid-workout control

---

## Phase 4: Audio Integration

### Objective
Implement the audio cue system with precise timing, timer-specific cues, and mute controls.

### Scope

**Audio Service Architecture**
- Modular audio service (designed for future audio file swapping)
- Web Audio API integration for precise timing
- Audio file preloading before timer start
- JSON configuration mapping checkpoints to audio files

**Universal Audio Checkpoints**
- Countdown: "3, 2, 1, Go!"
- Halfway point notification
- 1 minute remaining
- 30 seconds remaining
- 10 seconds remaining
- Completion: "Time!"

**Timer-Specific Audio Cues**
- EMOM: "Next round" at transitions, "5 seconds to next round"
- TABATA: "Work" / "Rest" at interval changes
- AMRAP: Universal checkpoints only
- FOR TIME: Universal checkpoints only

**Audio Scheduling**
- Calculate audio trigger points based on timer configuration
- Schedule audio playback at precise timestamps
- Handle pause/resume effect on scheduled audio
- Handle early stop cleanup

**Audio Controls**
- Mute/unmute toggle during workout
- Mute state persistence during session
- Visual indicator of mute state

**Audio Assets**
- Audio file format decisions (MP3/WAV)
- Initial audio file set (can be placeholder/TTS for development)
- Audio file organization structure

### Key Deliverables
- Working audio cues for all timer types
- Precise timing of audio playback
- Mute controls integrated into timer display
- Extensible architecture for future custom audio

### Dependencies
- Phase 3: Timer state machine and events

### Risks to Address
- Audio timing precision (use Web Audio API scheduling)
- Audio preloading on slow connections
- Browser autoplay policies

---

## Phase 5: Polish & Testing

### Objective
Refine UI/UX, optimize PWA capabilities, comprehensive testing, and prepare for beta launch.

### Scope

**UI/UX Refinement**
- Design system consistency audit
- Color palette implementation verification (dark purple/pink theme)
- Typography review (bold, athletic, distance-readable)
- Touch target sizing validation (minimum 44px)
- Animation and transition polish
- Loading states and skeleton screens
- Error states and user feedback
- Empty states (no workouts, etc.)

**PWA Optimization**
- Service worker caching strategy review
- Offline functionality verification
- App shell performance optimization
- Install prompt UX
- Splash screen and app icons
- Theme color and status bar styling

**Responsive Design Verification**
- Mobile breakpoint testing
- Tablet breakpoint testing
- Desktop breakpoint testing
- Large screen/TV display testing (timer mode)

**Cross-Browser Testing**
- Chrome (primary)
- Safari (iOS PWA behavior)
- Firefox
- Edge
- PWA installation flow per browser

**Cross-Device Testing**
- iOS devices (various screen sizes)
- Android devices (various screen sizes)
- Tablets
- Desktop browsers

**Offline Functionality Testing**
- Create WoD offline → sync when online
- Edit WoD offline → sync when online
- Timer operation fully offline
- Sync conflict scenarios

**Performance Testing**
- Initial load time
- Time to interactive
- Timer precision under load
- Audio playback reliability
- IndexedDB performance with large workout libraries

**Accessibility Review**
- Color contrast verification
- Screen reader compatibility (where applicable)
- Keyboard navigation (desktop)

**Beta Testing Preparation**
- Test account provisioning
- Feedback collection mechanism
- Known issues documentation
- Beta user onboarding guide

### Key Deliverables
- Production-ready UI/UX
- Verified PWA functionality across devices/browsers
- Comprehensive test coverage
- Beta-ready application

### Dependencies
- Phases 1-4 complete

### Risks to Address
- Browser-specific PWA quirks (especially iOS Safari)
- Audio playback edge cases
- Offline sync edge cases discovered in testing

---

## Phase Dependencies Diagram

```
Phase 1: Core Infrastructure
    │
    ├──→ Phase 2: WoD Management
    │         │
    │         └──→ Phase 3: Timer System
    │                   │
    │                   └──→ Phase 4: Audio Integration
    │                             │
    └─────────────────────────────┴──→ Phase 5: Polish & Testing
```

---

## Cross-Phase Considerations

### Design System
Establish in Phase 1, apply consistently through all phases:
- Color tokens: Primary purples (#2D1B4E, #4A2C6F), blacks, accent pinks (#E91E8C, #FF6B9D)
- Typography scale
- Spacing system
- Component library approach

### Error Handling
Define patterns in Phase 1, implement consistently:
- Network errors
- Sync failures
- Validation errors
- Unexpected states

### State Management
Svelte 5 runes-based state management, patterns established in Phase 1:
- Local component state
- Shared/global state (auth, sync status)
- Derived state patterns

### Testing Strategy
Define in Phase 1, expand each phase:
- Unit tests for utilities and services
- Component tests for UI
- Integration tests for flows
- E2E tests for critical paths

---

## Document Control

**Version**: 1.0
**Date**: December 22, 2025
**Status**: Ready for Implementation Planning
**Next Step**: Create detailed implementation plan for Phase 1
