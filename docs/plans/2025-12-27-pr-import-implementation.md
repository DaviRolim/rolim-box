# PR Import from Image - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to import Personal Records from screenshots using LLM-powered image analysis.

**Architecture:** Server-side image processing via Gemini Vision API. Multi-step modal flow (upload → process → review → confirm). Bulk import endpoint for atomic PR creation.

**Tech Stack:** SvelteKit, Drizzle ORM, AI SDK with OpenRouter/Gemini, Zod validation

---

## Task 1: Add Zod Schemas for Import

**Files:**
- Modify: `src/lib/types/pr.ts`

**Step 1: Add import response schemas to pr.ts**

Add after the existing schemas (around line 70):

```typescript
// ============================================================================
// Import Schemas
// ============================================================================

export const importedPRSchema = z.object({
	exerciseId: z.string(),
	exerciseName: z.string(),
	originalText: z.string(),
	value: z.number().positive(),
	confidence: z.enum(['high', 'medium', 'low'])
});

export const importAnalysisResponseSchema = z.object({
	matched: z.array(importedPRSchema),
	unmatched: z.array(z.string())
});

export const bulkImportItemSchema = z.object({
	exerciseId: z.string().min(1),
	value: z.number().positive()
});

export const bulkImportSchema = z.object({
	prs: z.array(bulkImportItemSchema).min(1)
});

export type ImportedPR = z.infer<typeof importedPRSchema>;
export type ImportAnalysisResponse = z.infer<typeof importAnalysisResponseSchema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
```

**Step 2: Verify no TypeScript errors**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check`
Expected: No errors related to pr.ts

**Step 3: Commit**

```bash
git add src/lib/types/pr.ts
git commit -m "feat(pr): add zod schemas for PR import"
```

---

## Task 2: Create Import Analysis API Endpoint

**Files:**
- Create: `src/routes/api/prs/import/+server.ts`

**Step 1: Create the import endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { exercise, personalRecord } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { env } from '$env/dynamic/private';
import { importAnalysisResponseSchema } from '$lib/types/pr';

const openrouter = createOpenAI({
	baseURL: 'https://openrouter.ai/api/v1',
	apiKey: env.OPENROUTER_API_KEY
});

const SYSTEM_PROMPT = `You are a fitness data extraction assistant. Extract personal records (PRs) from the provided image and match them to the given exercise database.

TASK:
1. Identify exercise names and their PR values from the image
2. Match each exercise to the closest one in the database (fuzzy match)
3. Detect units (kg, lbs, seconds, minutes, reps, meters, miles) and convert to base units
4. Return structured JSON

UNIT CONVERSIONS (to base units):
- Weight: kg × 1000 = grams, lbs × 453.592 = grams
- Time: parse MM:SS or HH:MM:SS to total seconds
- Distance: meters × 100 = centimeters, miles × 160934 = centimeters
- Reps: count as-is

MATCHING RULES:
- Only match if >70% confident in the match
- Consider common variations: "Back Squat" = "Back Squat (1RM)", "C&J" = "Clean and Jerk"
- If no good match, add to unmatched list

CONFIDENCE LEVELS:
- high: exact or near-exact name match
- medium: similar name, likely correct
- low: fuzzy match, user should verify`;

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Parse multipart form data
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return json({ error: 'Invalid form data' }, { status: 400 });
	}

	const imageFile = formData.get('image') as File | null;
	if (!imageFile) {
		return json({ error: 'No image provided' }, { status: 400 });
	}

	// Validate file type
	const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
	if (!validTypes.includes(imageFile.type)) {
		return json({ error: 'Invalid file type. Please upload PNG, JPG, or WEBP.' }, { status: 400 });
	}

	// Validate file size (5MB max)
	const maxSize = 5 * 1024 * 1024;
	if (imageFile.size > maxSize) {
		return json({ error: 'Image must be smaller than 5MB' }, { status: 400 });
	}

	// Get all exercises for matching
	const exercises = await db
		.select({
			id: exercise.id,
			name: exercise.name,
			measurementType: exercise.measurementType
		})
		.from(exercise)
		.orderBy(asc(exercise.sortOrder));

	// Get user's existing PRs for conflict detection
	const existingPRs = await db
		.select({
			exerciseId: personalRecord.exerciseId,
			value: personalRecord.value
		})
		.from(personalRecord)
		.where(eq(personalRecord.userId, locals.user.id));

	const existingPRMap = new Map(existingPRs.map((pr) => [pr.exerciseId, pr.value]));

	// Convert image to base64
	const imageBuffer = await imageFile.arrayBuffer();
	const base64Image = Buffer.from(imageBuffer).toString('base64');
	const mimeType = imageFile.type;

	// Build prompt with exercise database
	const exerciseList = exercises
		.map((e) => `- ID: ${e.id}, Name: "${e.name}", Type: ${e.measurementType}`)
		.join('\n');

	const userPrompt = `Extract all personal records from this image and match them to these exercises:

${exerciseList}

Return JSON with this exact structure:
{
  "matched": [
    {
      "exerciseId": "the-exercise-id",
      "exerciseName": "Exercise Name",
      "originalText": "exact text from image",
      "value": 12345,
      "confidence": "high"
    }
  ],
  "unmatched": ["Exercise Name 1", "Exercise Name 2"]
}`;

	try {
		const { output } = await generateText({
			model: openrouter('google/gemini-2.0-flash-001'),
			output: Output.object({
				schema: importAnalysisResponseSchema
			}),
			messages: [
				{
					role: 'system',
					content: SYSTEM_PROMPT
				},
				{
					role: 'user',
					content: [
						{
							type: 'image',
							image: `data:${mimeType};base64,${base64Image}`
						},
						{
							type: 'text',
							text: userPrompt
						}
					]
				}
			]
		});

		if (!output) {
			return json({ error: 'Failed to analyze image' }, { status: 500 });
		}

		// Enrich with conflict information
		const enrichedMatched = output.matched.map((pr) => ({
			...pr,
			hasConflict: existingPRMap.has(pr.exerciseId),
			existingValue: existingPRMap.get(pr.exerciseId) ?? null
		}));

		return json({
			matched: enrichedMatched,
			unmatched: output.unmatched
		});
	} catch (error) {
		console.error('Import analysis error:', error);
		return json({ error: 'Failed to analyze image. Please try again.' }, { status: 500 });
	}
};
```

**Step 2: Verify no TypeScript errors**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/routes/api/prs/import/+server.ts
git commit -m "feat(pr): add import analysis API endpoint"
```

---

## Task 3: Create Bulk Import API Endpoint

**Files:**
- Create: `src/routes/api/prs/bulk/+server.ts`

**Step 1: Create the bulk import endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { personalRecord, exercise } from '$lib/server/db/schema';
import { bulkImportSchema } from '$lib/types/pr';
import { generateId } from '$lib/server/auth';
import { inArray } from 'drizzle-orm';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const validation = bulkImportSchema.safeParse(body);
	if (!validation.success) {
		return json(
			{
				error: 'Validation failed',
				details: validation.error.flatten()
			},
			{ status: 400 }
		);
	}

	const { prs } = validation.data;

	// Verify all exercises exist
	const exerciseIds = [...new Set(prs.map((pr) => pr.exerciseId))];
	const existingExercises = await db
		.select({ id: exercise.id })
		.from(exercise)
		.where(inArray(exercise.id, exerciseIds));

	const existingIds = new Set(existingExercises.map((e) => e.id));
	const invalidIds = exerciseIds.filter((id) => !existingIds.has(id));

	if (invalidIds.length > 0) {
		return json(
			{
				error: 'Some exercises not found',
				invalidIds
			},
			{ status: 400 }
		);
	}

	// Insert all PRs
	const now = new Date();
	const today = now.toISOString().split('T')[0];

	const prRecords = prs.map((pr) => ({
		id: generateId(),
		userId: locals.user!.id,
		exerciseId: pr.exerciseId,
		value: pr.value,
		note: 'Imported from image',
		date: today,
		createdAt: now,
		updatedAt: now
	}));

	try {
		await db.insert(personalRecord).values(prRecords);

		return json({
			success: true,
			imported: prRecords.length
		});
	} catch (error) {
		console.error('Bulk import error:', error);
		return json({ error: 'Failed to import PRs' }, { status: 500 });
	}
};
```

**Step 2: Verify no TypeScript errors**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/routes/api/prs/bulk/+server.ts
git commit -m "feat(pr): add bulk import API endpoint"
```

---

## Task 4: Create ImportPRModal Component - Upload State

**Files:**
- Create: `src/routes/(app)/prs/ImportPRModal.svelte`

**Step 1: Create modal with upload state**

```svelte
<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import type { UnitPreference, ImportedPR } from '$lib/types/pr';
	import {
		formatPRValue,
		convertWeightForDisplay,
		convertDistanceForDisplay
	} from '$lib/types/pr';

	interface EnrichedImportedPR extends ImportedPR {
		hasConflict: boolean;
		existingValue: number | null;
	}

	interface Props {
		open: boolean;
		unitPreference: UnitPreference;
		onClose: () => void;
		onImported: () => void;
	}

	let { open = $bindable(), unitPreference, onClose, onImported }: Props = $props();

	// State
	type ModalState = 'upload' | 'processing' | 'review';
	let state = $state<ModalState>('upload');
	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let error = $state<string | null>(null);

	// Analysis results
	let matchedPRs = $state<EnrichedImportedPR[]>([]);
	let unmatchedExercises = $state<string[]>([]);
	let selectedPRs = $state<Set<string>>(new Set());
	let editedValues = $state<Map<string, number>>(new Map());

	// Dialog ref
	let dialogElement: HTMLDialogElement;

	// Handle dialog open/close
	$effect(() => {
		if (!dialogElement) return;

		if (open) {
			dialogElement.showModal();
			resetModal();
		} else {
			dialogElement.close();
		}
	});

	function resetModal() {
		state = 'upload';
		selectedFile = null;
		previewUrl = null;
		error = null;
		matchedPRs = [];
		unmatchedExercises = [];
		selectedPRs = new Set();
		editedValues = new Map();
	}

	function handleClose() {
		open = false;
		onClose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialogElement) {
			handleClose();
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			selectFile(file);
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		const file = e.dataTransfer?.files[0];
		if (file) {
			selectFile(file);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function selectFile(file: File) {
		// Validate type
		const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
		if (!validTypes.includes(file.type)) {
			error = 'Please upload a PNG, JPG, or WEBP image';
			return;
		}

		// Validate size (5MB)
		if (file.size > 5 * 1024 * 1024) {
			error = 'Image must be smaller than 5MB';
			return;
		}

		error = null;
		selectedFile = file;
		previewUrl = URL.createObjectURL(file);
	}

	function clearFile() {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
		selectedFile = null;
		previewUrl = null;
	}

	async function analyzeImage() {
		if (!selectedFile) return;

		state = 'processing';
		error = null;

		try {
			const formData = new FormData();
			formData.append('image', selectedFile);

			const res = await fetch('/api/prs/import', {
				method: 'POST',
				body: formData
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Failed to analyze image');
			}

			matchedPRs = data.matched;
			unmatchedExercises = data.unmatched;

			// Select all PRs by default
			selectedPRs = new Set(matchedPRs.map((pr) => pr.exerciseId));

			// Initialize edited values
			editedValues = new Map(matchedPRs.map((pr) => [pr.exerciseId, pr.value]));

			if (matchedPRs.length === 0) {
				error = 'No personal records found in this image. Make sure the image clearly shows exercise names and values.';
				state = 'upload';
				return;
			}

			state = 'review';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to analyze image';
			state = 'upload';
		}
	}

	function togglePR(exerciseId: string) {
		const newSet = new Set(selectedPRs);
		if (newSet.has(exerciseId)) {
			newSet.delete(exerciseId);
		} else {
			newSet.add(exerciseId);
		}
		selectedPRs = newSet;
	}

	function updateValue(exerciseId: string, value: number) {
		const newMap = new Map(editedValues);
		newMap.set(exerciseId, value);
		editedValues = newMap;
	}

	async function importPRs() {
		const prsToImport = matchedPRs
			.filter((pr) => selectedPRs.has(pr.exerciseId))
			.map((pr) => ({
				exerciseId: pr.exerciseId,
				value: editedValues.get(pr.exerciseId) ?? pr.value
			}));

		if (prsToImport.length === 0) return;

		state = 'processing';
		error = null;

		try {
			const res = await fetch('/api/prs/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prs: prsToImport })
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Failed to import PRs');
			}

			onImported();
			handleClose();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to import PRs';
			state = 'review';
		}
	}

	// Count selected PRs
	let selectedCount = $derived(selectedPRs.size);
	let hasConflicts = $derived(matchedPRs.some((pr) => pr.hasConflict && selectedPRs.has(pr.exerciseId)));
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialogElement}
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && handleClose()}
	class="m-0 h-full max-h-full w-full max-w-full bg-transparent p-0 md:m-auto md:h-auto md:max-h-[85vh] md:max-w-lg md:rounded-2xl"
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		onclick={(e) => e.stopPropagation()}
		class="flex h-full flex-col bg-bg-surface md:max-h-[85vh] md:rounded-2xl md:border md:border-white/10"
	>
		<!-- Header -->
		<div class="border-b border-white/10 p-4">
			<div class="flex items-start justify-between">
				<div>
					<h2 class="text-xl font-black text-white">Import PRs</h2>
					<p class="text-sm text-text-muted">
						{#if state === 'upload'}
							Upload a screenshot of your PRs
						{:else if state === 'processing'}
							Analyzing image...
						{:else}
							Review and confirm import
						{/if}
					</p>
				</div>
				<button
					onclick={handleClose}
					aria-label="Close"
					class="rounded-lg p-2 text-text-muted hover:bg-white/10 hover:text-white"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-4">
			{#if error}
				<div class="mb-4 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
					{error}
				</div>
			{/if}

			{#if state === 'upload'}
				<!-- Upload State -->
				{#if !selectedFile}
					<label
						class="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/5 p-8 transition-colors hover:border-accent-500/50 hover:bg-white/10"
						ondrop={handleDrop}
						ondragover={handleDragOver}
					>
						<svg class="mb-4 h-12 w-12 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
						<p class="mb-1 text-white font-medium">Drop image or click to upload</p>
						<p class="text-sm text-text-muted">PNG, JPG, or WEBP (max 5MB)</p>
						<input
							type="file"
							accept="image/png,image/jpeg,image/webp"
							onchange={handleFileSelect}
							class="hidden"
						/>
					</label>
				{:else}
					<!-- Preview -->
					<div class="rounded-xl border border-white/10 bg-white/5 p-4">
						<div class="relative mb-4">
							<img
								src={previewUrl}
								alt="Preview"
								class="max-h-64 w-full rounded-lg object-contain"
							/>
							<button
								onclick={clearFile}
								class="absolute -right-2 -top-2 rounded-full bg-bg-surface p-1 text-text-muted hover:text-white"
							>
								<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</button>
						</div>
						<p class="text-sm text-text-muted truncate">{selectedFile.name}</p>
					</div>
				{/if}

			{:else if state === 'processing'}
				<!-- Processing State -->
				<div class="flex flex-col items-center justify-center py-12">
					<div class="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-accent-500 border-t-transparent"></div>
					<p class="text-text-muted">Analyzing your PRs...</p>
				</div>

			{:else if state === 'review'}
				<!-- Review State -->
				<div class="space-y-4">
					<!-- Summary -->
					<div class="flex items-center gap-2 text-sm">
						<span class="text-white font-medium">Found {matchedPRs.length} PRs</span>
						{#if unmatchedExercises.length > 0}
							<span class="rounded-full bg-warning/20 px-2 py-0.5 text-xs text-warning">
								{unmatchedExercises.length} skipped
							</span>
						{/if}
					</div>

					<!-- PR List -->
					<div class="space-y-2">
						{#each matchedPRs as pr (pr.exerciseId)}
							{@const isSelected = selectedPRs.has(pr.exerciseId)}
							{@const currentValue = editedValues.get(pr.exerciseId) ?? pr.value}
							<div
								class="rounded-lg border p-3 transition-colors {isSelected
									? 'border-accent-500/30 bg-accent-500/10'
									: 'border-white/10 bg-white/5 opacity-50'}"
							>
								<div class="flex items-start gap-3">
									<input
										type="checkbox"
										checked={isSelected}
										onchange={() => togglePR(pr.exerciseId)}
										class="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-accent-500 focus:ring-accent-500"
									/>
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<p class="font-medium text-white truncate">{pr.exerciseName}</p>
											{#if pr.confidence !== 'high'}
												<span class="rounded bg-warning/20 px-1.5 py-0.5 text-xs text-warning">
													{pr.confidence}
												</span>
											{/if}
										</div>
										<p class="text-xs text-text-muted truncate">{pr.originalText}</p>
										{#if pr.hasConflict && pr.existingValue}
											<p class="mt-1 text-xs text-warning">
												Existing PR: {pr.existingValue} → {currentValue}
											</p>
										{/if}
									</div>
									<input
										type="number"
										value={currentValue}
										onchange={(e) => updateValue(pr.exerciseId, Number((e.target as HTMLInputElement).value))}
										disabled={!isSelected}
										class="w-24 rounded border border-white/10 bg-white/5 px-2 py-1 text-right text-white disabled:opacity-50"
									/>
								</div>
							</div>
						{/each}
					</div>

					<!-- Unmatched exercises -->
					{#if unmatchedExercises.length > 0}
						<details class="rounded-lg border border-white/10 bg-white/5">
							<summary class="cursor-pointer p-3 text-sm text-text-muted hover:text-white">
								{unmatchedExercises.length} exercises couldn't be matched
							</summary>
							<div class="border-t border-white/10 p-3">
								<ul class="space-y-1 text-sm text-text-muted">
									{#each unmatchedExercises as name}
										<li>• {name}</li>
									{/each}
								</ul>
							</div>
						</details>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="border-t border-white/10 p-4">
			{#if state === 'upload'}
				<Button
					onclick={analyzeImage}
					variant="primary"
					class="w-full"
					disabled={!selectedFile}
				>
					Analyze Image
				</Button>
			{:else if state === 'review'}
				<div class="flex gap-3">
					<Button onclick={() => (state = 'upload')} variant="secondary" class="flex-1">
						Back
					</Button>
					<Button
						onclick={importPRs}
						variant="primary"
						class="flex-1"
						disabled={selectedCount === 0}
					>
						Import {selectedCount} PR{selectedCount !== 1 ? 's' : ''}
					</Button>
				</div>
			{/if}
		</div>
	</div>
</dialog>

<style>
	dialog::backdrop {
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(4px);
	}

	dialog[open] {
		animation: slide-up 0.2s ease-out;
	}

	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
```

**Step 2: Verify no TypeScript errors**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/routes/(app)/prs/ImportPRModal.svelte
git commit -m "feat(pr): add ImportPRModal component"
```

---

## Task 5: Add Import Button to PR Page

**Files:**
- Modify: `src/routes/(app)/prs/+page.svelte`

**Step 1: Import the modal component**

Add to the imports (after line 16):

```typescript
import ImportPRModal from './ImportPRModal.svelte';
```

**Step 2: Add modal state**

Add after line 24 (`let modalOpen = $state(false);`):

```typescript
let importModalOpen = $state(false);
```

**Step 3: Add import success handler**

Add after `handlePRDeleted` function (around line 63):

```typescript
async function handleImportSuccess() {
	await invalidateAll();
	toastStore.success('PRs imported successfully!');
}
```

**Step 4: Add the modal component**

Add after the existing PRModal (around line 93):

```svelte
<ImportPRModal
	bind:open={importModalOpen}
	unitPreference={data.unitPreference}
	onClose={() => (importModalOpen = false)}
	onImported={handleImportSuccess}
/>
```

**Step 5: Add Import button to header**

Replace the header section (lines 97-104) with:

```svelte
<!-- Header -->
<header class="flex items-start justify-between border-b border-white/10 pb-4">
	<div>
		<h1
			class="bg-gradient-to-r from-white to-white/50 bg-clip-text text-3xl font-black tracking-tight text-transparent uppercase"
		>
			Personal Records
		</h1>
		<div class="h-1 w-16 bg-gradient-to-r from-accent-500 to-primary-500"></div>
	</div>
	<button
		onclick={() => (importModalOpen = true)}
		class="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-white/10 hover:text-white"
	>
		<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		Import
	</button>
</header>
```

**Step 6: Verify no TypeScript errors**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check`
Expected: No errors

**Step 7: Commit**

```bash
git add src/routes/(app)/prs/+page.svelte
git commit -m "feat(pr): add import button and modal to PR page"
```

---

## Task 6: Manual Testing

**Step 1: Start the dev server**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run dev`

**Step 2: Test the import flow**

1. Navigate to `/prs`
2. Click "Import" button in header
3. Verify modal opens with upload dropzone
4. Upload a test image with PR data
5. Verify processing state shows spinner
6. Verify review state shows matched PRs
7. Toggle some PRs on/off
8. Edit a value
9. Click "Import X PRs"
10. Verify success toast and modal closes
11. Verify PRs appear in the list

**Step 3: Test error cases**

1. Try uploading non-image file → should show error
2. Try uploading >5MB image → should show error
3. Try uploading image with no PRs → should show error message

---

## Task 7: Final Commit

**Step 1: Verify all changes work**

Run: `cd /home/daviholanda/code-projects/svelte/rolimbox && bun run check`
Expected: No errors

**Step 2: Create summary commit (if any uncommitted changes)**

```bash
git status
# If there are changes:
git add -A
git commit -m "feat(pr): complete PR import from image feature"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add Zod schemas | `src/lib/types/pr.ts` |
| 2 | Import analysis endpoint | `src/routes/api/prs/import/+server.ts` |
| 3 | Bulk import endpoint | `src/routes/api/prs/bulk/+server.ts` |
| 4 | ImportPRModal component | `src/routes/(app)/prs/ImportPRModal.svelte` |
| 5 | Add button to PR page | `src/routes/(app)/prs/+page.svelte` |
| 6 | Manual testing | - |
| 7 | Final verification | - |
