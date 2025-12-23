# AI Section Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI-powered section generation that creates WoD sections from a workout description using Vercel AI SDK and OpenRouter.

**Architecture:** Server-side API endpoint receives description, calls OpenRouter (google/gemini-3-flash-preview) via AI SDK's `generateObject` for structured JSON output, returns typed sections array. Client adds sparkles icon to description textarea that triggers generation with loading state and confirmation dialog.

**Tech Stack:** Vercel AI SDK (`ai`), OpenRouter via `@ai-sdk/openai`, Zod for schema validation, SvelteKit API routes.

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install AI SDK packages**

Run:
```bash
bun add ai @ai-sdk/openai
```

Expected: Packages added to dependencies in package.json

**Step 2: Verify installation**

Run:
```bash
bun run check
```

Expected: No TypeScript errors related to new packages

**Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: add Vercel AI SDK and OpenAI provider packages"
```

---

### Task 2: Add Environment Variable

**Files:**
- Modify: `.env.example`

**Step 1: Add OpenRouter API key placeholder**

Add to `.env.example`:

```
# OpenRouter API key for AI-powered section generation
OPENROUTER_API_KEY=""
```

**Step 2: Add actual key to local .env**

Add your OpenRouter API key to `.env` (do NOT commit this file).

**Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add OPENROUTER_API_KEY to env example"
```

---

### Task 3: Create AI Service

**Files:**
- Create: `src/lib/server/ai.ts`

**Step 1: Create the AI service file**

Create `src/lib/server/ai.ts`:

```typescript
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { env } from '$env/dynamic/private';

// Configure OpenRouter as OpenAI-compatible provider
const openrouter = createOpenAI({
	baseURL: 'https://openrouter.ai/api/v1',
	apiKey: env.OPENROUTER_API_KEY
});

// Timer config schema for AI response
const timerConfigSchema = z
	.object({
		type: z.enum(['amrap', 'fortime', 'emom', 'tabata']),
		duration: z.number().optional(), // seconds
		rounds: z.number().optional(),
		workTime: z.number().optional(), // for tabata
		restTime: z.number().optional() // for tabata
	})
	.nullable();

// Section schema for AI response
const generatedSectionSchema = z.object({
	type: z.enum(['warmup', 'skill', 'wod', 'cooldown', 'stretches', 'custom']),
	name: z.string(),
	content: z.string(),
	timerConfig: timerConfigSchema
});

// Full response schema
const generateSectionsResponseSchema = z.object({
	sections: z.array(generatedSectionSchema)
});

export type GeneratedSection = z.infer<typeof generatedSectionSchema>;

const SYSTEM_PROMPT = `You are a CrossFit/functional fitness workout designer. Given a workout description, generate structured workout sections.

RULES:
1. Always include appropriate sections based on the description
2. Common structure: warmup -> skill/strength -> wod -> cooldown (but adapt to description)
3. For timer configs, infer from workout text:
   - "AMRAP X" or "X minute AMRAP" -> amrap with duration in seconds
   - "For Time" or "X rounds for time" -> fortime with rounds
   - "EMOM X" -> emom with duration in seconds
   - "Tabata" -> tabata with workTime=20, restTime=10 (or as specified)
4. If no timer pattern detected, set timerConfig to null
5. Keep section names concise (e.g., "Warmup", "Strength", "Metcon", "Cool-down")
6. Format content with line breaks between exercises
7. Use standard exercise notation (e.g., "3x10 Back Squats @70%", "21-15-9 Thrusters/Pull-ups")

SECTION TYPES:
- warmup: General warm-up, mobility, activation
- skill: Skill practice, technique work
- wod: The main workout/metcon
- cooldown: Cool-down, recovery
- stretches: Stretching, flexibility work
- custom: Anything that doesn't fit above`;

export async function generateWodSections(description: string): Promise<GeneratedSection[]> {
	const { object } = await generateObject({
		model: openrouter('google/gemini-2.0-flash-001'),
		schema: generateSectionsResponseSchema,
		system: SYSTEM_PROMPT,
		prompt: `Generate workout sections for this description:\n\n${description}`
	});

	return object.sections;
}
```

**Step 2: Verify no TypeScript errors**

Run:
```bash
bun run check
```

Expected: PASS with no errors

**Step 3: Commit**

```bash
git add src/lib/server/ai.ts
git commit -m "feat: add AI service for section generation"
```

---

### Task 4: Create API Endpoint

**Files:**
- Create: `src/routes/api/wods/generate-sections/+server.ts`

**Step 1: Create the API endpoint**

Create `src/routes/api/wods/generate-sections/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { generateWodSections } from '$lib/server/ai';

const requestSchema = z.object({
	description: z.string().min(5, 'Description must be at least 5 characters')
});

export const POST: RequestHandler = async ({ locals, request }) => {
	// Check authentication
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Parse and validate request body
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const validation = requestSchema.safeParse(body);
	if (!validation.success) {
		return json(
			{
				error: 'Validation failed',
				details: validation.error.flatten()
			},
			{ status: 400 }
		);
	}

	try {
		const sections = await generateWodSections(validation.data.description);

		if (sections.length === 0) {
			return json(
				{ error: 'Could not generate sections from this description. Try adding more detail.' },
				{ status: 422 }
			);
		}

		// Convert timerConfig objects to JSON strings to match Section type
		const formattedSections = sections.map((section, index) => ({
			type: section.type,
			name: section.name,
			content: section.content,
			order: index,
			timerConfig: section.timerConfig ? JSON.stringify(section.timerConfig) : null
		}));

		return json({ sections: formattedSections });
	} catch (error) {
		console.error('AI generation error:', error);

		// Check for specific error types
		if (error instanceof Error) {
			if (error.message.includes('API key')) {
				return json({ error: 'AI service configuration error' }, { status: 500 });
			}
			if (error.message.includes('rate') || error.message.includes('limit')) {
				return json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
			}
		}

		return json({ error: 'Failed to generate sections. Please try again.' }, { status: 500 });
	}
};
```

**Step 2: Verify no TypeScript errors**

Run:
```bash
bun run check
```

Expected: PASS with no errors

**Step 3: Commit**

```bash
git add src/routes/api/wods/generate-sections/+server.ts
git commit -m "feat: add API endpoint for AI section generation"
```

---

### Task 5: Add Sparkles Icon and UI to New Workout Page

**Files:**
- Modify: `src/routes/(app)/workouts/new/+page.svelte`

**Step 1: Add state variables for AI generation**

After line 27 (`let isSaving = $state(false);`), add:

```typescript
let isGenerating = $state(false);
let showReplaceConfirm = $state(false);
```

**Step 2: Add the generateSections function**

After the `handleCancel` function (around line 245), add:

```typescript
// Handle AI section generation
async function generateSections() {
	if (description.length < 5) return;

	// If sections exist, show confirmation dialog
	if (sections.length > 0) {
		showReplaceConfirm = true;
		return;
	}

	await doGenerateSections();
}

async function doGenerateSections() {
	showReplaceConfirm = false;
	isGenerating = true;

	try {
		const response = await fetch('/api/wods/generate-sections', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ description })
		});

		const data = await response.json();

		if (!response.ok) {
			throw new Error(data.error || 'Failed to generate sections');
		}

		// Replace sections with generated ones
		sections = data.sections.map((section: { type: SectionType; name: string; content: string; order: number; timerConfig: string | null }, index: number) => ({
			id: `temp-${Date.now()}-${index}`,
			wodId: '',
			type: section.type,
			name: section.name,
			content: section.content,
			order: index,
			timerConfig: section.timerConfig
		}));

		toastStore.success('Sections generated successfully');
	} catch (error) {
		console.error('Failed to generate sections:', error);
		toastStore.error(error instanceof Error ? error.message : 'Failed to generate sections. Please try again.');
	} finally {
		isGenerating = false;
	}
}

function cancelReplaceConfirm() {
	showReplaceConfirm = false;
}

function confirmReplace() {
	doGenerateSections();
}
```

**Step 3: Wrap textarea in relative container and add sparkles button**

Replace the description textarea block (lines 291-311) with:

```svelte
<!-- Description textarea -->
<div class="form-group">
	<label class="form-label" for="workout-description">
		Description (optional)
		<span class="form-hint">{description.length}/500</span>
	</label>
	<div class="textarea-wrapper">
		<textarea
			id="workout-description"
			class="form-textarea"
			class:error={descriptionError}
			bind:value={description}
			placeholder="Add a brief description of the workout..."
			maxlength="500"
			rows="3"
			aria-invalid={!!descriptionError}
			aria-describedby={descriptionError ? 'description-error' : undefined}
		></textarea>
		{#if description.length >= 5}
			<button
				type="button"
				class="btn-generate"
				onclick={generateSections}
				disabled={isGenerating || isSaving}
				aria-label="Generate sections with AI"
				title="Generate sections with AI"
			>
				{#if isGenerating}
					<svg
						class="spinner"
						width="20"
						height="20"
						viewBox="0 0 20 20"
						fill="none"
						stroke="currentColor"
					>
						<circle cx="10" cy="10" r="8" stroke-width="3" stroke-dasharray="50" />
					</svg>
				{:else}
					<img src="/icons/sparkles.png" alt="" width="20" height="20" class="sparkles-icon" />
				{/if}
			</button>
		{/if}
	</div>
	{#if descriptionError}
		<p id="description-error" class="form-error" role="alert">{descriptionError}</p>
	{/if}
</div>
```

**Step 4: Add confirmation dialog before the form-actions div**

Before the `<!-- Save button -->` comment (around line 347), add:

```svelte
<!-- Replace sections confirmation dialog -->
{#if showReplaceConfirm}
	<div class="confirm-dialog-backdrop" onclick={cancelReplaceConfirm}>
		<div class="confirm-dialog" onclick={(e) => e.stopPropagation()}>
			<p class="confirm-message">
				This will replace your existing {sections.length} section{sections.length === 1 ? '' : 's'}. Continue?
			</p>
			<div class="confirm-actions">
				<button type="button" class="btn-cancel" onclick={cancelReplaceConfirm}>
					Cancel
				</button>
				<button type="button" class="btn-confirm" onclick={confirmReplace}>
					Generate
				</button>
			</div>
		</div>
	</div>
{/if}
```

**Step 5: Add CSS styles**

Add these styles inside the `<style>` block:

```css
/* Textarea wrapper for sparkles button positioning */
.textarea-wrapper {
	position: relative;
}

.btn-generate {
	position: absolute;
	bottom: 12px;
	right: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	background: rgba(110, 72, 159, 0.2);
	border: 2px solid #6e489f;
	border-radius: 8px;
	cursor: pointer;
	transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-generate:hover:not(:disabled) {
	background: rgba(110, 72, 159, 0.4);
	transform: scale(1.05);
}

.btn-generate:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.btn-generate:focus-visible {
	outline: 2px solid #6e489f;
	outline-offset: 2px;
}

.sparkles-icon {
	filter: invert(1);
}

/* Confirmation dialog */
.confirm-dialog-backdrop {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 200;
}

.confirm-dialog {
	background: #1a1a1a;
	border: 2px solid #2a2a2a;
	padding: 24px;
	max-width: 400px;
	width: 90%;
}

.confirm-message {
	font-family: 'Inter', system-ui, -apple-system, sans-serif;
	font-size: 16px;
	color: #ffffff;
	margin: 0 0 24px 0;
	line-height: 1.5;
}

.confirm-actions {
	display: flex;
	gap: 12px;
	justify-content: flex-end;
}

.btn-cancel,
.btn-confirm {
	font-family: 'Inter', system-ui, -apple-system, sans-serif;
	font-size: 14px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	padding: 12px 20px;
	cursor: pointer;
	transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-cancel {
	background: transparent;
	border: 2px solid #2a2a2a;
	color: #a3a3a3;
}

.btn-cancel:hover {
	background: #2a2a2a;
	color: #ffffff;
}

.btn-confirm {
	background: linear-gradient(135deg, #6e489f 0%, #5c3a87 100%);
	border: 2px solid #6e489f;
	color: #ffffff;
}

.btn-confirm:hover {
	transform: translateY(-1px);
	box-shadow: 0 4px 12px rgba(110, 72, 159, 0.3);
}
```

**Step 6: Verify no TypeScript errors**

Run:
```bash
bun run check
```

Expected: PASS with no errors

**Step 7: Commit**

```bash
git add src/routes/\(app\)/workouts/new/+page.svelte
git commit -m "feat: add AI section generation UI with sparkles icon"
```

---

### Task 6: Manual Testing

**Step 1: Start development server**

Run:
```bash
bun run dev
```

**Step 2: Test the feature manually**

1. Navigate to `/workouts/new`
2. Type a description with fewer than 5 characters - verify sparkles icon is NOT visible
3. Type 5+ characters (e.g., "AMRAP 12 minutes: 10 burpees, 15 air squats, 20 double unders") - verify sparkles icon appears
4. Click the sparkles icon - verify loading spinner appears
5. Wait for generation - verify sections are populated
6. Add more description text and click sparkles again - verify confirmation dialog appears
7. Click Cancel - verify nothing changes
8. Click Generate - verify sections are replaced

**Step 3: Test error handling**

1. Remove OPENROUTER_API_KEY from .env temporarily
2. Try generating sections - verify error toast appears
3. Restore OPENROUTER_API_KEY

---

### Task 7: Final Verification

**Step 1: Run all checks**

Run:
```bash
bun run check && bun run lint
```

Expected: PASS with no errors

**Step 2: Run E2E tests (if any existing tests)**

Run:
```bash
bun run test:e2e
```

Expected: Existing tests still pass

**Step 3: Final commit (if any remaining changes)**

```bash
git status
# If changes exist:
git add .
git commit -m "chore: cleanup and final adjustments"
```
