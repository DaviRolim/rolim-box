# Workspace Leaderboard & PR Comparison Design

## Overview

Two related features for workspace-based PR competition:

1. **Workspace Leaderboard** - Points-based ranking where users earn 1 point for each exercise where they hold the highest PR
2. **Exercise Rankings** - Per-exercise comparison showing all workspace members' PRs sorted best to worst

## Key Decisions

| Decision | Choice |
|----------|--------|
| PR scope | User-level, shared across all workspaces |
| Points system | 1 point per exercise with highest PR |
| Ties | Both users get full point |
| Exercises counted | All predefined exercises |
| Opt-out | None - everyone appears |
| Comparison display | Full ranking list per exercise |
| UI location | Tab inside PRs section + preview in PR modal |
| Time scope | All-time only |
| Role differences | None - same view for everyone |

## Data Model

No new tables needed. The leaderboard is computed from existing data:
- Query `personalRecord` for all users in a workspace
- Group by exercise, find max/min (depending on measurement type)
- Count points per user

This keeps the database simple and avoids sync issues.

## Navigation & Routes

```
/prs → Main PR page with tabs:
  [My PRs] [Leaderboard]
```

## UI Design

### Leaderboard Page Layout

```
┌─────────────────────────────────────────────────────┐
│  [My PRs]  [Leaderboard]                            │
├─────────────────────────────────────────────────────┤
│  🏆 Workspace Leaderboard                           │
│                                                     │
│  #1  João Silva         12 pts   ████████████      │
│  #2  Maria Santos       10 pts   ██████████        │
│  #3  You                 8 pts   ████████          │
│  #4  Pedro Costa         5 pts   █████             │
│  #5  Ana Lima            3 pts   ███               │
├─────────────────────────────────────────────────────┤
│  Exercise Breakdown                                 │
│  ───────────────────────────────────────────────    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ Back Squat   │  │ Deadlift     │  │ Clean     │ │
│  │ 🥇 João      │  │ 🥇 Maria     │  │ 🥇 You    │ │
│  │    150kg     │  │    180kg     │  │    95kg   │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│  ┌──────────────┐  ┌──────────────┐                │
│  │ Fran         │  │ Murph        │                │
│  │ 🥇 Pedro     │  │ 🥇 João      │                │
│  │    2:45      │  │    35:20     │                │
│  └──────────────┘  └──────────────┘                │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- Current user highlighted with "You" label
- Progress bars visualize relative points
- Exercise cards show leader + their PR value
- Clicking an exercise card opens full ranking modal for that exercise
- Exercises with no PRs from anyone show "No PRs yet" (still clickable)

### Exercise Ranking Modal

When clicking an exercise card on the leaderboard:

```
┌─────────────────────────────────────────────────────┐
│  Back Squat Rankings                             ✕  │
│  Weightlifting · Weight                             │
├─────────────────────────────────────────────────────┤
│  🥇  João Silva         150kg     Dec 20, 2024     │
│  🥈  Maria Santos       140kg     Dec 15, 2024     │
│  🥉  You                130kg     Dec 10, 2024     │
│  #4  Pedro Costa        120kg     Nov 28, 2024     │
│  #5  Ana Lima           100kg     Nov 15, 2024     │
│  ──────────────────────────────────────────────     │
│  3 members haven't logged this exercise yet         │
└─────────────────────────────────────────────────────┘
```

### PR Modal Integration

Add a "Rankings" section below the history in the existing PR modal:

```
┌─────────────────────────────────────────────────────┐
│  Back Squat                                      ✕  │
│  Weightlifting · Weight                             │
├─────────────────────────────────────────────────────┤
│  [+ Log New PR form...]                             │
├─────────────────────────────────────────────────────┤
│  Your History                                       │
│  🏆 130kg    Dec 10, 2024                          │
│     125kg    Nov 20, 2024                          │
├─────────────────────────────────────────────────────┤
│  Workspace Rankings                                 │
│  You're #3 of 8                                     │
│  ───────────────────────────────────────────────    │
│  🥇 João 150kg  🥈 Maria 140kg  🥉 You 130kg       │
│                           [See full rankings →]    │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- Shows condensed top 3 + your position
- "See full rankings" opens the full exercise ranking modal
- If user has no PR for this exercise, shows "Log a PR to join the rankings"

## API Endpoints

### New Endpoints

```
GET /api/workspaces/[id]/leaderboard
  → Returns ranked users with points + exercise breakdown

GET /api/workspaces/[id]/exercises/[exerciseId]/rankings
  → Returns all members' best PRs for that exercise, sorted
```

### Leaderboard Response

```typescript
{
  rankings: [
    { userId, name, points: 12, rank: 1 },
    { userId, name, points: 10, rank: 2 },
    // ...
  ],
  exerciseLeaders: [
    { exerciseId, exerciseName, leaders: [{ userId, name, value }] },
    // ...
  ],
  totalExercises: 45,  // all predefined exercises
  activeExercises: 12  // exercises with at least one PR
}
```

### Exercise Rankings Response

```typescript
{
  exercise: { id, name, category, measurementType },
  rankings: [
    { rank: 1, userId, name, value, date },
    { rank: 2, userId, name, value, date },
    // ...
  ],
  totalMembers: 8,
  membersWithPR: 5
}
```

### Performance Note

Leaderboard queries join `workspaceMember` → `user` → `personalRecord` → `exercise`. For workspaces with many members, consider caching or computing on PR update.

## Leaderboard Calculation Logic

```typescript
// For each exercise:
// 1. Get best PR per user in workspace (highest for weight/reps/distance, lowest for time)
// 2. Find the winning value(s)
// 3. Award 1 point to each user with the winning value

// Best PR logic by measurement type:
// - weight: highest value wins
// - reps: highest value wins
// - distance: highest value wins
// - time: lowest value wins
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User belongs to multiple workspaces | Leaderboard shows rankings for active workspace only |
| User has no PRs | Appears on leaderboard with 0 points |
| Exercise has no PRs from anyone | Shows "No PRs yet" - first to log claims the point |
| User leaves workspace | Their PRs no longer count in that workspace's leaderboard |
| Tie for 1st place | Both users get 1 point, both shown as 🥇 |
| User's PR deleted | Leaderboard recalculates, point may shift to new leader |

### Single-User Workspace

If a workspace has only one member:
- Leaderboard shows them with points for every exercise they've logged
- Exercise rankings show only their PR
- Not particularly useful, but works correctly

## Out of Scope (v1)

- Historical leaderboard snapshots ("who was #1 last month")
- Notifications when someone beats your PR
- Category-filtered leaderboards (e.g., "weightlifting only")
- Coach-specific analytics
- Opt-out or privacy settings
- Gamification beyond points (badges, streaks, etc.)

These can be added later if there's demand.
