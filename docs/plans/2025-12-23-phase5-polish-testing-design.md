# Phase 5: Polish & Testing - Design Document

**Date:** December 23, 2025
**Status:** Ready for Implementation
**Reference:** [Development Phases Spec](../specs/development_phases_spec.md)

---

## Overview

Phase 5 focuses on production readiness for beta launch: bug fixes, UI/UX polish, design system extraction, and cross-browser verification.

### Goals

- Fix known bugs (timer attachment, empty states)
- Establish maintainable design system using Tailwind
- Ensure consistent loading/error/empty states
- Verify PWA functionality on target browsers

### Out of Scope

- Safari/iOS testing
- Major component rewrites
- New features

---

## 1. Bug Fixes

### 1.1 Timer Attachment Bug

**Symptoms:** Timer config added to section doesn't appear when viewing WoD.

**Investigation:**
- Verify `bind:this` works correctly with TimerConfig component in Svelte 5
- Check if `timerConfigComponent.getConfig()` returns valid data before form submission
- Add console logging to trace data flow through the save pipeline

**Likely fix locations:**
- `src/lib/components/sections/EditSectionForm.svelte`
- `src/lib/components/timer/TimerConfig.svelte`

**Data flow to verify:**
```
EditSectionForm.handleSubmit()
  → timerConfigComponent.getConfig()
  → serializeTimerConfig()
  → onSave({ timerConfig })
  → edit/+page.svelte handleSaveSection()
  → sections state update
  → handleSave()
  → updateWoD()
  → IndexedDB cacheSections()
  → getWoD()
  → parseTimerConfig()
  → WoD view render
```

### 1.2 Empty Section State

**Current:** Large box with "No sections yet" message in WoD edit view.

**Fix:** Remove the empty state box entirely. The "Add Section" button is self-explanatory.

**Location:** `src/routes/(app)/workouts/[id]/edit/+page.svelte`

---

## 2. Design System

### 2.1 Approach

Extend Tailwind v4 config with brand colors. Use Tailwind's existing spacing scale (already aligned with current values). Migrate components gradually as they're touched.

### 2.2 Tailwind Theme Extension

Add to `src/app.css` or Tailwind config:

```css
@theme {
  /* Brand */
  --color-primary: #6e489f;
  --color-primary-dark: #5c3a87;
  --color-accent: #e91e8c;
  --color-accent-dark: #be185d;

  /* Backgrounds */
  --color-bg-base: #0a0a0a;
  --color-bg-surface: #1a1a1a;
  --color-bg-elevated: #2a2a2a;

  /* Section Colors */
  --color-section-warmup: #f97316;
  --color-section-skill: #3b82f6;
  --color-section-wod: #e91e8c;
  --color-section-cooldown: #06b6d4;
  --color-section-stretches: #a855f7;
  --color-section-custom: #6b7280;
}
```

### 2.3 Spacing Reference

Current values map to Tailwind scale:

| Pixels | Tailwind | Usage |
|--------|----------|-------|
| 8px | `2` | xs gaps |
| 12px | `3` | sm gaps |
| 16px | `4` | md padding |
| 20px | `5` | lg padding |
| 24px | `6` | xl padding |
| 32px | `8` | 2xl sections |

### 2.4 Migration Strategy

- Do NOT rewrite all components at once
- When touching a component for bug fix or feature, convert hardcoded values
- Use `var(--color-*)` in CSS or Tailwind utilities in markup

---

## 3. Loading, Error & Empty States

### 3.1 Audit Results

| Screen | Loading | Error | Empty |
|--------|---------|-------|-------|
| Workouts list | Skeleton | Toast | Review needed |
| WoD view | Skeleton | Toast + 404 | Remove oversized box |
| WoD edit | Spinner | Toast + 404 | N/A |
| Timer | Verify | Verify | N/A |
| Dashboard | Verify | Verify | Verify |

### 3.2 Patterns

**Loading:**
- `Skeleton` component for content placeholders
- Spinner only for action buttons (Save, Submit)

**Errors:**
- Toast for recoverable errors (network, validation)
- Full-page state for unrecoverable (404, auth)

**Empty States:**
- Keep minimal - just a CTA button when possible
- Only add illustration/text if the action isn't obvious

### 3.3 Implementation Tasks

1. Audit Dashboard page for missing states
2. Audit Timer page for missing states
3. Remove oversized empty section box from WoD edit
4. Document patterns in code comments

---

## 4. Cross-Browser & PWA Verification

### 4.1 Browser Matrix

| Browser | Priority | Notes |
|---------|----------|-------|
| Chrome (Android) | High | Primary target |
| Chrome (Desktop) | Medium | Development reference |
| Firefox | Low | Verify no major breaks |

### 4.2 PWA Checklist

**Installation:**
- [ ] Manifest valid (icons, theme colors, display mode)
- [ ] Install prompt works on Chrome Android
- [ ] App launches in standalone mode

**Offline:**
- [ ] Service worker caches app shell
- [ ] Timer works fully offline
- [ ] WoD CRUD works offline (queues sync)
- [ ] Audio files cached and play offline

**Audio:**
- [ ] Audio cues fire during timer
- [ ] Mute state persists correctly

### 4.3 Testing Approach

1. Manual testing on real Android device or emulator
2. Playwright E2E for critical flows:
   - Create WoD with sections
   - Run timer with audio
   - Offline WoD creation and sync
3. Lighthouse PWA audit (target 90+ score)

---

## 5. Deliverables Summary

| Category | Items |
|----------|-------|
| Bug Fixes | Timer attachment, empty section box |
| Design System | Tailwind theme extension, migration guide |
| States | Dashboard/Timer audit, pattern documentation |
| Testing | Chrome/Android manual, Playwright E2E, Lighthouse |

---

## Document Control

**Version:** 1.0
**Author:** Claude (AI-assisted)
**Next Step:** Create detailed implementation plan
