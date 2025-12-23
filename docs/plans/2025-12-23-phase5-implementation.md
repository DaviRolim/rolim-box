# Phase 5: Polish & Testing - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Production-ready beta with bug fixes, design system, consistent UI states, and verified PWA functionality.

**Architecture:** Fix timer attachment bug first (blocking issue), then extract design tokens to Tailwind, audit UI states, and add E2E tests for critical flows.

**Tech Stack:** SvelteKit, Svelte 5, Tailwind CSS v4, Playwright

---

## Task 1: Investigate Timer Attachment Bug

**Files:**
- Debug: `src/lib/components/sections/EditSectionForm.svelte`
- Debug: `src/lib/components/timer/TimerConfig.svelte`
- Debug: `src/lib/services/wod.ts`

**Step 1: Add debug logging to EditSectionForm**

Add console.log before and after getting timer config:

```svelte
// In EditSectionForm.svelte, modify handleSubmit():
function handleSubmit() {
    if (!validateForm()) return;

    let timerConfig: string | null = null;
    if (showTimerConfig && timerConfigComponent) {
        console.log('[DEBUG] timerConfigComponent exists:', !!timerConfigComponent);
        const config = timerConfigComponent.getConfig();
        console.log('[DEBUG] getConfig() returned:', config);
        timerConfig = serializeTimerConfig(config);
        console.log('[DEBUG] serialized timerConfig:', timerConfig);
    }

    onSave({
        type: selectedType,
        name: name.trim(),
        content: content.trim(),
        timerConfig
    });
}
```

**Step 2: Test manually in browser**

1. Run: `bun run dev`
2. Navigate to a WoD → Edit
3. Edit a section → Add Timer → Configure → Save Section
4. Check browser console for DEBUG logs
5. Save WoD → View WoD
6. Check if timer button appears

**Step 3: Document findings**

Record in this file what the debug logs show:
- Does `timerConfigComponent` exist? (bind:this working?)
- Does `getConfig()` return valid data?
- Is `timerConfig` serialized correctly?

---

## Task 2: Fix Timer Attachment Bug

**Files:**
- Modify: `src/lib/components/sections/EditSectionForm.svelte`

**Depends on:** Task 1 findings

**Step 1: Apply fix based on investigation**

If `bind:this` is undefined (likely Svelte 5 issue), fix by ensuring the component is mounted:

```svelte
// Option A: Add mounted check
let mounted = $state(false);
$effect(() => {
    mounted = true;
});

function handleSubmit() {
    if (!validateForm()) return;

    let timerConfig: string | null = null;
    if (showTimerConfig && mounted && timerConfigComponent) {
        timerConfig = serializeTimerConfig(timerConfigComponent.getConfig());
    }
    // ...
}
```

If the issue is different, apply appropriate fix based on Task 1 findings.

**Step 2: Remove debug logging**

Remove all `console.log('[DEBUG]` lines added in Task 1.

**Step 3: Test the fix**

1. Edit a section → Add Timer (AMRAP 15 min)
2. Save section → Save WoD
3. View WoD → Verify timer button shows "AMRAP - 15:00"
4. Click timer → Verify it launches with correct config

**Step 4: Commit**

```bash
git add src/lib/components/sections/EditSectionForm.svelte
git commit -m "fix: timer attachment not persisting when saving section"
```

---

## Task 3: Remove Empty Section State Box

**Files:**
- Modify: `src/routes/(app)/workouts/[id]/edit/+page.svelte`

**Step 1: Locate the empty state in SectionList**

Check `src/lib/components/sections/SectionList.svelte` for empty state rendering.

**Step 2: Read SectionList to understand current behavior**

```bash
# Verify file contents
cat src/lib/components/sections/SectionList.svelte
```

**Step 3: Remove or simplify empty state**

If empty state box exists in SectionList, remove it. The "Add Section" button is sufficient.

Before:
```svelte
{#if sections.length === 0}
    <div class="empty-state">
        <p>No sections yet</p>
    </div>
{/if}
```

After:
```svelte
<!-- Empty state removed - Add Section button is self-explanatory -->
```

**Step 4: Test**

1. Create new WoD (no sections)
2. Verify no large empty box appears
3. Verify "Add Section" button is visible and works

**Step 5: Commit**

```bash
git add src/lib/components/sections/SectionList.svelte
git commit -m "fix: remove redundant empty section state box"
```

---

## Task 4: Extend Tailwind Theme with Section Colors

**Files:**
- Modify: `src/routes/layout.css`

**Step 1: Add missing design tokens**

Add section colors and text colors to existing `@theme` block:

```css
@theme {
    /* Primary - Dark Purple (existing) */
    --color-primary-900: #2d1b4e;
    --color-primary-800: #3d2663;
    --color-primary-700: #4a2c6f;
    --color-primary-600: #5c3a87;
    --color-primary-500: #6e489f;

    /* Secondary - Black (existing) */
    --color-secondary-900: #0a0a0a;
    --color-secondary-800: #1a1a1a;
    --color-secondary-700: #2a2a2a;

    /* Accent - Pink (existing) */
    --color-accent-500: #e91e8c;
    --color-accent-400: #ff6b9d;
    --color-accent-300: #ff8fb3;
    --color-accent-600: #be185d;

    /* Muted (existing) */
    --color-muted: #8b7ab8;

    /* NEW: Section Colors */
    --color-section-warmup: #f97316;
    --color-section-skill: #3b82f6;
    --color-section-wod: #e91e8c;
    --color-section-cooldown: #06b6d4;
    --color-section-stretches: #a855f7;
    --color-section-custom: #6b7280;

    /* NEW: Text Colors */
    --color-text-primary: #ffffff;
    --color-text-secondary: #a3a3a3;
    --color-text-muted: #737373;
    --color-text-disabled: #525252;

    /* NEW: Semantic Colors */
    --color-error: #ef4444;
    --color-success: #22c55e;

    /* NEW: Border Colors */
    --color-border-default: #2a2a2a;
    --color-border-hover: #3a3a3a;
}
```

**Step 2: Verify build works**

```bash
bun run build
```

Expected: Build succeeds without errors

**Step 3: Commit**

```bash
git add src/routes/layout.css
git commit -m "feat: extend Tailwind theme with section, text, and semantic colors"
```

---

## Task 5: Migrate One Component to Use Design Tokens

**Files:**
- Modify: `src/lib/components/sections/SectionCard.svelte`

**Step 1: Replace hardcoded colors with CSS variables**

Find and replace in SectionCard.svelte:

| Find | Replace |
|------|---------|
| `#f97316` | `var(--color-section-warmup)` |
| `#3b82f6` | `var(--color-section-skill)` |
| `#e91e8c` | `var(--color-section-wod)` |
| `#06b6d4` | `var(--color-section-cooldown)` |
| `#a855f7` | `var(--color-section-stretches)` |
| `#6b7280` | `var(--color-section-custom)` |
| `#0a0a0a` | `var(--color-secondary-900)` |
| `#1a1a1a` | `var(--color-secondary-800)` |
| `#2a2a2a` | `var(--color-secondary-700)` |
| `#ef4444` | `var(--color-error)` |

**Step 2: Test component renders correctly**

1. Navigate to a WoD with sections
2. Verify colors display correctly
3. Verify hover states work

**Step 3: Commit**

```bash
git add src/lib/components/sections/SectionCard.svelte
git commit -m "refactor: migrate SectionCard to use design tokens"
```

---

## Task 6: Add E2E Test for WoD Creation Flow

**Files:**
- Create: `e2e/wod-crud.test.ts`

**Step 1: Create test file with WoD creation test**

```typescript
import { expect, test } from '@playwright/test';

test.describe('WoD CRUD', () => {
    test.beforeEach(async ({ page }) => {
        // TODO: Add auth setup if needed
        // For now, assume test user is logged in
    });

    test('can create a new WoD with sections', async ({ page }) => {
        // Navigate to new WoD page
        await page.goto('/workouts/new');

        // Fill in date (should default to today)
        const dateInput = page.locator('input[type="date"]');
        await expect(dateInput).toBeVisible();

        // Fill in description
        await page.fill('textarea', 'Test workout description');

        // Add a section
        await page.click('text=Add Section');

        // Fill section details
        await page.fill('input[id="section-name"]', 'Test Warmup');
        await page.fill('textarea[id="section-content"]', '400m run\n20 air squats');

        // Save section
        await page.click('text=Add Section');

        // Save WoD
        await page.click('text=Save');

        // Verify redirect to WoD view
        await expect(page).toHaveURL(/\/workouts\/[a-z0-9-]+$/);

        // Verify content is displayed
        await expect(page.locator('text=Test Warmup')).toBeVisible();
        await expect(page.locator('text=400m run')).toBeVisible();
    });
});
```

**Step 2: Run the test**

```bash
bun run test:e2e
```

Expected: Test may fail due to auth - note what needs to be set up.

**Step 3: Commit**

```bash
git add e2e/wod-crud.test.ts
git commit -m "test: add E2E test for WoD creation flow"
```

---

## Task 7: Add E2E Test for Timer Flow

**Files:**
- Create: `e2e/timer.test.ts`

**Step 1: Create timer test file**

```typescript
import { expect, test } from '@playwright/test';

test.describe('Timer', () => {
    test('can configure and start AMRAP timer', async ({ page }) => {
        await page.goto('/timer?type=amrap');

        // Verify timer config is visible
        await expect(page.locator('text=AMRAP')).toBeVisible();

        // Verify duration input exists
        const durationInput = page.locator('input[id="duration"]');
        await expect(durationInput).toBeVisible();

        // Click start
        await page.click('text=START TIMER');

        // Verify navigated to timer display
        await expect(page).toHaveURL('/timer/standalone');

        // Verify timer display is visible
        await expect(page.locator('[class*="timer-display"]')).toBeVisible();
    });

    test('can switch between timer types', async ({ page }) => {
        await page.goto('/timer');

        // Click EMOM
        await page.click('button:has-text("EMOM")');

        // Verify rounds input appears
        await expect(page.locator('input[id="rounds"]')).toBeVisible();

        // Click TABATA
        await page.click('button:has-text("TABATA")');

        // Verify work/rest inputs appear
        await expect(page.locator('input[id="work"]')).toBeVisible();
        await expect(page.locator('input[id="rest"]')).toBeVisible();
    });
});
```

**Step 2: Run the test**

```bash
bun run test:e2e e2e/timer.test.ts
```

**Step 3: Commit**

```bash
git add e2e/timer.test.ts
git commit -m "test: add E2E tests for timer configuration flow"
```

---

## Task 8: Run Lighthouse PWA Audit

**Files:**
- None (manual audit)

**Step 1: Build and preview**

```bash
bun run build && bun run preview
```

**Step 2: Run Lighthouse in Chrome**

1. Open Chrome DevTools (F12)
2. Go to Lighthouse tab
3. Select: Performance, Accessibility, Best Practices, PWA
4. Click "Analyze page load"

**Step 3: Document results**

Record scores and any failing audits:
- Performance: ___
- Accessibility: ___
- Best Practices: ___
- PWA: ___

Failing audits to address:
- [ ] ...

**Step 4: Fix critical PWA issues if any**

Common issues:
- Missing icons in manifest
- Service worker not caching correctly
- Missing theme-color meta tag

---

## Task 9: Final Testing on Android Chrome

**Files:**
- None (manual testing)

**Step 1: Deploy to preview URL or use ngrok**

```bash
bun run build && bun run preview
# In another terminal:
# ngrok http 4173
```

**Step 2: Test on Android device**

Checklist:
- [ ] App loads correctly
- [ ] Can install as PWA (Add to Home Screen)
- [ ] App opens in standalone mode
- [ ] Timer works with audio cues
- [ ] Can create/edit/view WoDs
- [ ] Offline mode works (airplane mode)

**Step 3: Document any issues found**

Record issues for follow-up if any.

---

## Task 10: Final Commit and Summary

**Step 1: Check git status**

```bash
git status
```

**Step 2: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: phase 5 polish and testing complete"
```

**Step 3: Create summary**

Phase 5 complete:
- [x] Timer attachment bug fixed
- [x] Empty section state removed
- [x] Design tokens extracted to Tailwind
- [x] E2E tests for WoD and Timer flows
- [x] Lighthouse audit completed
- [x] Android Chrome testing completed

---

## Appendix: File Reference

| File | Purpose |
|------|---------|
| `src/routes/layout.css` | Tailwind theme tokens |
| `src/lib/components/sections/EditSectionForm.svelte` | Section editing with timer |
| `src/lib/components/sections/SectionList.svelte` | Section list with empty state |
| `src/lib/components/sections/SectionCard.svelte` | Individual section display |
| `src/lib/components/timer/TimerConfig.svelte` | Timer configuration form |
| `e2e/wod-crud.test.ts` | E2E tests for WoD flow |
| `e2e/timer.test.ts` | E2E tests for timer flow |
