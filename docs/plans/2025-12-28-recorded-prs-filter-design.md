# Recorded PRs Filter Design

## Problem

Users must navigate between multiple category tabs (Weightlifting, Benchmarks, Gymnastics, Cardio) to see all their recorded PRs. This makes it difficult to get a complete view of their progress.

## Solution

Add a "Recorded" category tab that shows all exercises with recorded PRs across all categories in one consolidated view, grouped by category.

## Core Behavior

### New "Recorded" Category Tab
- Add a new tab at the beginning of the category pills row, before "Weightlifting"
- Label: "Recorded"
- When selected, shows all exercises that have a `bestPR` value, grouped by category

### Default Tab Logic
- On page load, check if user has any recorded PRs
- If yes: default to "Recorded" tab
- If no: default to "Weightlifting" tab

### Grouped Display
- When "Recorded" is active, show section headers for each category that has PRs
- Only show categories that have at least one recorded PR
- Under each header, display exercise cards in a grid (same style as current)
- Categories appear in standard order: Weightlifting, Benchmarks, Gymnastics, Cardio

### Search Behavior
- Search continues to work across all exercises (unchanged)
- When searching, category tabs are hidden (current behavior preserved)

## Visual Design

### "Recorded" Tab Styling
- Same styling as other category pills
- Active: `bg-accent-500 text-white`
- Inactive: `bg-white/5 text-text-muted`
- Position: First in the row

### Category Section Headers
- Simple text header above each group
- Style: `text-sm font-bold uppercase text-text-muted`
- Small bottom margin before the grid of cards

### Cards
- Identical to current cards (no changes)
- Shows: exercise name, PR value, date

### Empty State
- If "Recorded" tab selected with no PRs: "No PRs recorded yet. Select a category to start tracking!"

## Implementation Details

### Type Changes
- Create `ActiveCategory` type: `ExerciseCategory | 'recorded'`
- Update `activeCategory` state to use this type

### Derived State Updates
- Modify `filteredExercises` logic:
  - If `activeCategory === 'recorded'`: filter exercises where `bestPR` exists (don't filter by category)
  - Otherwise: current behavior (filter by category)

### New Derived State: Grouped Exercises
- When `activeCategory === 'recorded'`, compute grouped structure
- Group filtered exercises by their `category` field
- Only include groups with at least one exercise

### Default Category Selection
- Check if any exercise has a `bestPR` on component initialization
- Set initial `activeCategory` based on this check

### Category Tabs Rendering
- Render "Recorded" tab first (handled separately)
- Then map over `EXERCISE_CATEGORIES` for remaining tabs
