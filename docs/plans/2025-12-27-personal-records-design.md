# Personal Records (PRs) Feature Design

## Overview

A feature for tracking Personal Records (PRs) across exercises within RolimBox. Users can log their best performances for weightlifting, benchmark workouts, gymnastics, and cardio exercises, with full history tracking and progression visibility.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Exercise definition | Predefined list only (no custom exercises) |
| Measurement per exercise | Fixed - one measurement type per exercise (variants approach) |
| Measurement types | Weight, Time, Reps, Distance |
| History tracking | Full history (all entries preserved) |
| WoD linking | Standalone (no connection to workouts) |
| Units | User preference (metric/imperial) stored in settings |
| Navigation | Top-level nav item alongside Dashboard, Workouts, Timers |
| Page layout | Category tabs + card grid + search bar |
| Logging flow | Modal form triggered from exercise cards |
| History view | Modal with history list and add form |
| Notes | Optional, collapsed by default |

## Data Model

### New Tables

```sql
-- Predefined exercises (seeded on deploy)
Exercise
├── id (primary key)
├── name (text, e.g., "Back Squat", "Fran", "5K Run")
├── category (text: "weightlifting" | "benchmark" | "gymnastics" | "cardio")
├── measurementType (text: "weight" | "time" | "reps" | "distance")
└── sortOrder (integer, for display ordering within category)

-- User's personal records
PersonalRecord
├── id (primary key)
├── userId (FK → User)
├── exerciseId (FK → Exercise)
├── value (numeric, stored in base units: kg, seconds, count, meters)
├── note (text, nullable)
├── date (text, ISO date "YYYY-MM-DD")
├── createdAt (timestamp)
└── updatedAt (timestamp)
```

### User Table Addition

```sql
User (existing table)
├── ... existing fields
└── unitPreference (text: "metric" | "imperial", default "metric")
```

### Storage Rules

- **Weight**: stored in kilograms
- **Time**: stored in seconds
- **Distance**: stored in meters
- **Reps**: stored as count (no conversion)

Values are converted to user's preferred units on display.

## Navigation & Routes

### Updated Navigation

```
Dashboard | Workouts | Timers | PRs
```

### Route Structure

```
/prs    → Main PR page (category tabs + card grid + search)
```

All interactions happen via modals on the main page - no sub-routes needed.

## UI Design

### Main PR Page Layout

```
┌─────────────────────────────────────────────────────┐
│  [Search: Find exercise...]                         │
├─────────────────────────────────────────────────────┤
│  [Weightlifting] [Benchmarks] [Gymnastics] [Cardio] │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Back Squat   │  │ Deadlift     │  │ Clean      │ │
│  │ 140kg        │  │ 180kg        │  │ 95kg       │ │
│  │ Dec 15, 2024 │  │ Nov 3, 2024  │  │ Oct 1, 2024│ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ Snatch       │  │ Front Squat  │                 │
│  │ No PR yet    │  │ 100kg        │                 │
│  │              │  │ Sep 20, 2024 │                 │
│  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- Search filters across all categories in real-time
- When searching, category tabs are hidden and results show in flat list
- Cards without PRs show "No PR yet" in muted text
- Clicking a card opens the history/add modal

### Exercise Card Content

Each card displays:
- Exercise name
- Best PR value (in user's preferred units)
- Date of best PR

### Exercise Modal (History + Add)

```
┌─────────────────────────────────────────────────────┐
│  Back Squat                                      ✕  │
│  Weightlifting · Weight                             │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐  │
│  │ + Log New PR                                  │  │
│  │   ┌─────────────┐  ┌─────────────┐            │  │
│  │   │ Value (kg)  │  │ Date        │            │  │
│  │   └─────────────┘  └─────────────┘            │  │
│  │   [+ Add note]                                │  │
│  │                              [Save PR]        │  │
│  └───────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  History                                            │
│  ──────────────────────────────────────────────     │
│  🏆 140kg    Dec 15, 2024    "Felt strong"          │
│     135kg    Nov 28, 2024                           │
│     130kg    Nov 10, 2024    "After deload week"    │
│     125kg    Oct 15, 2024                           │
│  ──────────────────────────────────────────────     │
│  [Load more...]                                     │
└─────────────────────────────────────────────────────┘
```

**Modal behavior:**
- Date field defaults to today
- Value input shows units based on user preference
- "Add note" expands a text field when clicked
- History sorted by date descending (most recent first)
- Best PR marked with trophy icon regardless of position
- Each history entry can be deleted (with confirmation)

## API Endpoints

```
GET    /api/exercises           → List all predefined exercises
GET    /api/prs                 → Get user's PRs (optionally filter by exerciseId)
POST   /api/prs                 → Log a new PR { exerciseId, value, date, note? }
DELETE /api/prs/[id]            → Delete a PR entry

PATCH  /api/user/settings       → Update user preferences { unitPreference }
```

## Unit Conversion

```typescript
// Weight
const KG_TO_LBS = 2.20462;
// kg → lbs: value * KG_TO_LBS
// lbs → kg: value / KG_TO_LBS

// Distance
const METERS_TO_MILES = 0.000621371;
// meters → miles: value * METERS_TO_MILES
// miles → meters: value / METERS_TO_MILES

// Time: stored as seconds, displayed as mm:ss or hh:mm:ss
// Reps: no conversion needed
```

## Best PR Calculation

| Measurement Type | Best = |
|------------------|--------|
| Weight | Highest value |
| Reps | Highest value |
| Distance | Highest value |
| Time | Lowest value |

## Settings Page Addition

Add unit preference to existing settings:

```
┌─────────────────────────────────────────────────────┐
│  Units                                              │
│  ○ Metric (kg, meters)                              │
│  ● Imperial (lbs, miles)                            │
└─────────────────────────────────────────────────────┘
```

## Predefined Exercises

### Weightlifting
| Exercise | Measurement |
|----------|-------------|
| Back Squat | weight |
| Front Squat | weight |
| Overhead Squat | weight |
| Deadlift | weight |
| Clean | weight |
| Clean & Jerk | weight |
| Snatch | weight |
| Power Clean | weight |
| Power Snatch | weight |
| Push Press | weight |
| Push Jerk | weight |
| Strict Press | weight |
| Bench Press | weight |
| Thruster | weight |

### Benchmarks
| Exercise | Measurement |
|----------|-------------|
| Fran | time |
| Grace | time |
| Isabel | time |
| Helen | time |
| Diane | time |
| Elizabeth | time |
| Nancy | time |
| Annie | time |
| Jackie | time |
| Karen | time |
| Murph | time |
| Cindy - 20 min | reps |
| Fight Gone Bad | reps |

### Gymnastics
| Exercise | Measurement |
|----------|-------------|
| Max Pull-ups | reps |
| Max Chest-to-Bar | reps |
| Max Muscle-ups | reps |
| Max Ring Muscle-ups | reps |
| Max Handstand Push-ups | reps |
| Max Toes-to-Bar | reps |
| Max Double-unders | reps |

### Cardio
| Exercise | Measurement |
|----------|-------------|
| 400m Run | time |
| 800m Run | time |
| 1 Mile Run | time |
| 5K Run | time |
| 500m Row | time |
| 2K Row | time |
| 1K Bike Erg | time |
| 5K Bike Erg | time |

## Out of Scope

- Custom exercises (predefined only)
- PR-to-WoD linking
- Progression charts/graphs (can be added later)
- Social features (sharing PRs)
- Calories and Rounds+Reps measurement types
