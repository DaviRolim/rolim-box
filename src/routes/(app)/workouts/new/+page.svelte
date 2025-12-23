<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import SectionList from '$lib/components/sections/SectionList.svelte';
	import AddSectionForm from '$lib/components/sections/AddSectionForm.svelte';
	import EditSectionForm from '$lib/components/sections/EditSectionForm.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { createWoD } from '$lib/services/wod';
	import type { Section, SectionType } from '$lib/types/wod';

	interface Props {
		data: {
			workspaceId: string;
		};
	}

	let { data }: Props = $props();

	// Form state
	let date = $state('');
	let description = $state('');
	let sections = $state<Section[]>([]);
	let showAddForm = $state(false);
	let editingSection = $state<Section | null>(null);
	let isSaving = $state(false);
	let isGenerating = $state(false);
	let showReplaceConfirm = $state(false);

	// Form validation errors
	let dateError = $state('');
	let descriptionError = $state('');

	// Track if form has unsaved changes
	let hasUnsavedChanges = $state(false);

	// Initialize date to today
	onMount(() => {
		const today = new Date().toISOString().split('T')[0];
		date = today;
	});

	// Track changes
	$effect(() => {
		// Check if there are any changes
		void date;
		void description;
		void sections.length;
		hasUnsavedChanges = sections.length > 0 || description.trim() !== '';
	});

	// Confirm before navigating away with unsaved changes
	beforeNavigate((navigation) => {
		if (hasUnsavedChanges && !isSaving) {
			const confirmed = confirm(
				'You have unsaved changes. Are you sure you want to leave this page?'
			);
			if (!confirmed) {
				navigation.cancel();
			}
		}
	});

	// Handle browser events (tab close, back button, window close)
	$effect(() => {
		if (!browser) return;

		const handler = (e: BeforeUnloadEvent) => {
			if (hasUnsavedChanges && !isSaving) {
				e.preventDefault();
				e.returnValue = ''; // Required for Chrome
			}
		};

		window.addEventListener('beforeunload', handler);

		return () => {
			window.removeEventListener('beforeunload', handler);
		};
	});

	// Validate form
	function validateForm(): boolean {
		dateError = '';
		descriptionError = '';

		// Validate date
		if (!date) {
			dateError = 'Date is required';
			return false;
		}

		const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
		if (!dateRegex.test(date)) {
			dateError = 'Date must be in YYYY-MM-DD format';
			return false;
		}

		const parsedDate = new Date(date);
		if (isNaN(parsedDate.getTime())) {
			dateError = 'Invalid date';
			return false;
		}

		// Validate description
		if (description && description.length > 500) {
			descriptionError = 'Description must be 500 characters or less';
			return false;
		}

		// Validate sections
		if (sections.length === 0) {
			toastStore.error('Please add at least one section');
			return false;
		}

		return true;
	}

	// Handle section add
	function handleAddSection(sectionData: { type: SectionType; name: string; content: string; timerConfig: string | null }) {
		const newSection: Section = {
			id: `temp-${Date.now()}-${Math.random()}`,
			wodId: '', // Will be set when WoD is created
			type: sectionData.type,
			name: sectionData.name,
			content: sectionData.content,
			order: sections.length,
			timerConfig: sectionData.timerConfig
		};

		sections = [...sections, newSection];
		showAddForm = false;
		toastStore.success('Section added');
	}

	// Handle section reorder
	function handleReorder(fromIndex: number, toIndex: number) {
		const newSections = [...sections];
		const [moved] = newSections.splice(fromIndex, 1);
		newSections.splice(toIndex, 0, moved);

		// Update order property
		sections = newSections.map((section, index) => ({
			...section,
			order: index
		}));
	}

	// Handle section edit
	function handleEditSection(section: Section) {
		editingSection = section;
	}

	// Handle section save
	function handleSaveSection(updates: { type: SectionType; name: string; content: string; timerConfig: string | null }) {
		if (!editingSection) return;

		const editingSectionId = editingSection.id;
		sections = sections.map((section) =>
			section.id === editingSectionId
				? {
						...section,
						type: updates.type,
						name: updates.name,
						content: updates.content,
						timerConfig: updates.timerConfig
					}
				: section
		);

		editingSection = null;
		toastStore.success('Section updated');
	}

	// Handle section delete
	function handleDeleteSection(section: Section) {
		const confirmed = confirm(`Delete section "${section.name}"?`);
		if (!confirmed) return;

		sections = sections
			.filter((s) => s.id !== section.id)
			.map((section, index) => ({
				...section,
				order: index
			}));

		toastStore.success('Section deleted');
	}

	// Handle cancel edit
	function handleCancelEdit() {
		editingSection = null;
	}

	// Handle cancel add
	function handleCancelAdd() {
		showAddForm = false;
	}

	// Handle save workout
	async function handleSave() {
		if (!validateForm()) return;

		isSaving = true;

		try {
			// Prepare sections data (remove temporary IDs)
			const sectionsData = sections.map((section, index) => ({
				type: section.type,
				name: section.name,
				content: section.content,
				order: index,
				timerConfig: section.timerConfig
			}));

			// Create WoD
			await createWoD({
				workspaceId: data.workspaceId,
				date,
				description: description.trim() || null,
				sections: sectionsData
			});

			toastStore.success('Workout created successfully');
			hasUnsavedChanges = false;

			// Navigate to workouts list
			goto('/workouts');
		} catch (error) {
			console.error('Failed to create workout:', error);
			toastStore.error('Failed to create workout. Please try again.');
			isSaving = false;
		}
	}

	// Handle cancel
	function handleCancel() {
		if (hasUnsavedChanges) {
			const confirmed = confirm(
				'You have unsaved changes. Are you sure you want to cancel?'
			);
			if (!confirmed) return;
		}
		goto('/workouts');
	}

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
</script>

<div class="create-page">
	<!-- Header -->
	<header class="page-header">
		<button type="button" class="btn-back" onclick={handleCancel} aria-label="Cancel">
			<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
				<path d="M12 4L6 10L12 16" stroke-width="2" stroke-linecap="square" />
			</svg>
			Cancel
		</button>

		<h1 class="page-title">New Workout</h1>
	</header>

	<!-- Form -->
	<div class="page-content">
		<form class="workout-form" onsubmit={(e) => e.preventDefault()}>
			<!-- Date input -->
			<div class="form-group">
				<label class="form-label" for="workout-date">Date</label>
				<div class="date-input-wrapper">
					<input
						id="workout-date"
						type="date"
						class="form-input date-input"
						class:error={dateError}
						bind:value={date}
						aria-invalid={!!dateError}
						aria-describedby={dateError ? 'date-error' : undefined}
					/>
					<div class="date-icon" aria-hidden="true">
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
							<rect x="3" y="4" width="14" height="14" stroke-width="2" stroke-linecap="square" />
							<line x1="3" y1="8" x2="17" y2="8" stroke-width="2" stroke-linecap="square" />
							<line x1="7" y1="2" x2="7" y2="6" stroke-width="2" stroke-linecap="square" />
							<line x1="13" y1="2" x2="13" y2="6" stroke-width="2" stroke-linecap="square" />
						</svg>
					</div>
				</div>
				{#if dateError}
					<p id="date-error" class="form-error" role="alert">{dateError}</p>
				{/if}
			</div>

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

			<!-- Sections -->
			<div class="form-group">
				<label class="form-label">Sections</label>

				{#if editingSection}
					<EditSectionForm
						section={editingSection}
						onSave={handleSaveSection}
						onCancel={handleCancelEdit}
					/>
				{:else}
					<SectionList
						{sections}
						editable={true}
						onReorder={handleReorder}
						onEdit={handleEditSection}
						onDelete={handleDeleteSection}
					/>

					{#if showAddForm}
						<div class="add-section-wrapper">
							<AddSectionForm onAdd={handleAddSection} onCancel={handleCancelAdd} />
						</div>
					{:else}
						<button type="button" class="btn-add-section" onclick={() => (showAddForm = true)}>
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
								<path d="M10 4V16M4 10H16" stroke-width="2" stroke-linecap="square" />
							</svg>
							Add Section
						</button>
					{/if}
				{/if}
			</div>

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

			<!-- Save button -->
			<div class="form-actions">
				<button
					type="button"
					class="btn-save"
					onclick={handleSave}
					disabled={isSaving}
					aria-busy={isSaving}
				>
					{#if isSaving}
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
						Saving...
					{:else}
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
							<path d="M4 10L8 14L16 6" stroke-width="2" stroke-linecap="square" />
						</svg>
						Save Workout
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>

<style>
	.create-page {
		min-height: 100vh;
		background: #0a0a0a;
		padding-bottom: 40px;
	}

	/* Header */
	.page-header {
		position: sticky;
		top: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 20px 24px;
		background: #0a0a0a;
		border-bottom: 2px solid #2a2a2a;
	}

	.btn-back {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 12px 16px;
		background: transparent;
		border: 2px solid #2a2a2a;
		color: #a3a3a3;
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.btn-back:hover {
		background: #2a2a2a;
		border-color: #3a3a3a;
		color: #ffffff;
		transform: translateY(-1px);
	}

	.btn-back:active {
		transform: translateY(0);
	}

	.btn-back:focus-visible {
		outline: 2px solid #6e489f;
		outline-offset: 2px;
	}

	.page-title {
		flex: 1;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 24px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: -0.01em;
		color: #ffffff;
		margin: 0;
	}

	/* Content */
	.page-content {
		max-width: 800px;
		margin: 0 auto;
		padding: 32px 24px;
	}

	.workout-form {
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.form-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #ffffff;
	}

	.form-hint {
		font-size: 11px;
		font-weight: 600;
		color: #525252;
	}

	.date-input-wrapper {
		position: relative;
	}

	.form-input,
	.form-textarea {
		width: 100%;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 16px;
		font-weight: 400;
		padding: 16px 18px;
		background: #1a1a1a;
		border: 2px solid #2a2a2a;
		color: #ffffff;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.date-input {
		padding-right: 50px;
	}

	.date-icon {
		position: absolute;
		right: 16px;
		top: 50%;
		transform: translateY(-50%);
		color: #525252;
		pointer-events: none;
	}

	.form-input:focus,
	.form-textarea:focus {
		outline: none;
		border-color: #6e489f;
		box-shadow: 0 0 0 3px rgba(110, 72, 159, 0.15);
	}

	.form-input.error,
	.form-textarea.error {
		border-color: #ef4444;
	}

	.form-input::placeholder,
	.form-textarea::placeholder {
		color: #525252;
	}

	.form-textarea {
		resize: vertical;
		line-height: 1.6;
	}

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

	.form-error {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 12px;
		font-weight: 600;
		color: #ef4444;
		margin: 0;
	}

	.add-section-wrapper {
		margin-top: 16px;
	}

	.btn-add-section {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 18px 24px;
		background: transparent;
		border: 2px dashed #2a2a2a;
		color: #a3a3a3;
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		margin-top: 16px;
	}

	.btn-add-section:hover {
		background: rgba(110, 72, 159, 0.1);
		border-color: #6e489f;
		border-style: solid;
		color: #6e489f;
		transform: translateY(-2px);
	}

	.btn-add-section:active {
		transform: translateY(0);
	}

	.btn-add-section:focus-visible {
		outline: 2px solid #6e489f;
		outline-offset: 2px;
	}

	.form-actions {
		display: flex;
		justify-content: center;
		margin-top: 16px;
	}

	.btn-save {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 16px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 20px 48px;
		background: linear-gradient(135deg, #6e489f 0%, #5c3a87 100%);
		border: 2px solid #6e489f;
		color: #ffffff;
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		min-width: 240px;
		box-shadow: 0 4px 16px rgba(110, 72, 159, 0.3);
		position: relative;
	}

	.btn-save:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(110, 72, 159, 0.4);
	}

	.btn-save:active:not(:disabled) {
		transform: translateY(0);
	}

	.btn-save:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-save:focus-visible {
		outline: 2px solid #6e489f;
		outline-offset: 2px;
	}

	.spinner {
		animation: spin 1s linear infinite;
	}

	.btn-generate .spinner {
		color: #6e489f;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Mobile optimization */
	@media (max-width: 640px) {
		.page-header {
			padding: 16px 20px;
		}

		.page-title {
			font-size: 20px;
		}

		.btn-back {
			font-size: 13px;
			padding: 10px 14px;
		}

		.page-content {
			padding: 24px 20px;
		}

		.workout-form {
			gap: 24px;
		}

		.btn-save {
			width: 100%;
			min-width: 0;
			padding: 18px 32px;
			font-size: 14px;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.btn-back,
		.btn-add-section,
		.btn-save,
		.spinner {
			animation: none;
			transition: none;
		}

		.btn-back:hover,
		.btn-add-section:hover,
		.btn-save:hover {
			transform: none;
		}
	}
</style>
