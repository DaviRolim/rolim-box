<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import SectionList from '$lib/components/sections/SectionList.svelte';
	import AddSectionForm from '$lib/components/sections/AddSectionForm.svelte';
	import EditSectionForm from '$lib/components/sections/EditSectionForm.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { getWoD, updateWoD } from '$lib/services/wod';
	import type { Section, SectionType, WoD } from '$lib/types/wod';

	interface Props {
		data: {
			wodId: string;
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
	let isLoading = $state(true);
	let notFound = $state(false);

	// WoD metadata
	let wodData = $state<WoD | null>(null);
	let lastUpdated = $state<Date | null>(null);

	// Form validation errors
	let dateError = $state('');
	let descriptionError = $state('');

	// Track if form has unsaved changes
	let hasUnsavedChanges = $state(false);
	let initialFormState = $state<string>('');

	// Load existing WoD data
	onMount(async () => {
		try {
			const wod = await getWoD(data.wodId);

			if (!wod) {
				notFound = true;
				isLoading = false;
				toastStore.error('Workout not found');
				return;
			}

			wodData = wod;
			date = wod.date;
			description = wod.description || '';
			sections = [...wod.sections];
			lastUpdated = wod.updatedAt;

			// Store initial form state for change detection
			initialFormState = JSON.stringify({
				date: wod.date,
				description: wod.description || '',
				sections: wod.sections.map((s) => ({
					type: s.type,
					name: s.name,
					content: s.content,
					order: s.order
				}))
			});

			isLoading = false;
		} catch (error) {
			console.error('Failed to load workout:', error);
			toastStore.error('Failed to load workout');
			notFound = true;
			isLoading = false;
		}
	});

	// Track changes
	$effect(() => {
		// Check if there are any changes
		void date;
		void description;
		void sections.length;

		if (initialFormState && !isLoading) {
			const currentState = JSON.stringify({
				date,
				description,
				sections: sections.map((s) => ({
					type: s.type,
					name: s.name,
					content: s.content,
					order: s.order
				}))
			});
			hasUnsavedChanges = currentState !== initialFormState;
		}
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
	function handleAddSection(sectionData: { type: SectionType; name: string; content: string }) {
		const newSection: Section = {
			id: `temp-${Date.now()}-${Math.random()}`,
			wodId: data.wodId,
			type: sectionData.type,
			name: sectionData.name,
			content: sectionData.content,
			order: sections.length,
			timerConfig: null
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

	// Handle save changes
	async function handleSave() {
		if (!validateForm()) return;

		isSaving = true;

		try {
			// Prepare sections data
			const sectionsData = sections.map((section, index) => ({
				type: section.type,
				name: section.name,
				content: section.content,
				order: index,
				timerConfig: section.timerConfig
			}));

			// Update WoD
			await updateWoD(data.wodId, {
				date,
				description: description.trim() || null,
				sections: sectionsData
			});

			toastStore.success('Workout updated successfully');
			hasUnsavedChanges = false;

			// Navigate to view page
			goto(`/workouts/${data.wodId}`);
		} catch (error) {
			console.error('Failed to update workout:', error);
			toastStore.error('Failed to update workout. Please try again.');
			isSaving = false;
		}
	}

	// Handle cancel
	function handleCancel() {
		if (hasUnsavedChanges) {
			const confirmed = confirm('You have unsaved changes. Are you sure you want to cancel?');
			if (!confirmed) return;
		}
		goto(`/workouts/${data.wodId}`);
	}

	// Format date for display
	function formatUpdatedDate(date: Date): string {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(date);
	}
</script>

{#if isLoading}
	<div class="loading-container">
		<div class="loading-spinner">
			<svg
				width="48"
				height="48"
				viewBox="0 0 48 48"
				fill="none"
				stroke="currentColor"
				class="spinner"
			>
				<circle cx="24" cy="24" r="20" stroke-width="4" stroke-dasharray="125" />
			</svg>
		</div>
		<p class="loading-text">Loading workout...</p>
	</div>
{:else if notFound}
	<div class="not-found-container">
		<div class="not-found-icon">
			<svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor">
				<circle cx="32" cy="32" r="28" stroke-width="3" />
				<line x1="22" y1="22" x2="42" y2="42" stroke-width="3" stroke-linecap="square" />
				<line x1="42" y1="22" x2="22" y2="42" stroke-width="3" stroke-linecap="square" />
			</svg>
		</div>
		<h1 class="not-found-title">Workout Not Found</h1>
		<p class="not-found-message">The workout you're looking for doesn't exist or has been deleted.</p>
		<button type="button" class="btn-back-to-list" onclick={() => goto('/workouts')}>
			Back to Workouts
		</button>
	</div>
{:else}
	<div class="edit-page">
		<!-- Header -->
		<header class="page-header">
			<button type="button" class="btn-back" onclick={handleCancel} aria-label="Cancel">
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
					<path d="M12 4L6 10L12 16" stroke-width="2" stroke-linecap="square" />
				</svg>
				Cancel
			</button>

			<h1 class="page-title">Edit Workout</h1>
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
							Save Changes
						{/if}
					</button>
				</div>
			</form>

			<!-- Last updated timestamp -->
			{#if lastUpdated && !hasUnsavedChanges}
				<footer class="page-footer">
					<p class="last-updated">Last updated: {formatUpdatedDate(lastUpdated)}</p>
				</footer>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Loading state */
	.loading-container {
		min-height: 100vh;
		background: #0a0a0a;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 24px;
	}

	.loading-spinner {
		color: #6e489f;
	}

	.loading-text {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 16px;
		font-weight: 600;
		color: #a3a3a3;
		margin: 0;
	}

	/* Not found state */
	.not-found-container {
		min-height: 100vh;
		background: #0a0a0a;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 24px;
		text-align: center;
	}

	.not-found-icon {
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #525252;
		margin-bottom: 24px;
	}

	.not-found-title {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 28px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: -0.01em;
		color: #ffffff;
		margin: 0 0 16px 0;
	}

	.not-found-message {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 16px;
		font-weight: 400;
		line-height: 1.6;
		color: #737373;
		margin: 0 0 32px 0;
		max-width: 400px;
	}

	.btn-back-to-list {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 16px 32px;
		background: linear-gradient(135deg, #6e489f 0%, #5c3a87 100%);
		border: 2px solid #6e489f;
		color: #ffffff;
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 4px 16px rgba(110, 72, 159, 0.3);
	}

	.btn-back-to-list:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(110, 72, 159, 0.4);
	}

	.btn-back-to-list:active {
		transform: translateY(0);
	}

	.btn-back-to-list:focus-visible {
		outline: 2px solid #6e489f;
		outline-offset: 2px;
	}

	/* Main page */
	.edit-page {
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

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* Footer */
	.page-footer {
		margin-top: 32px;
		padding-top: 24px;
		border-top: 1px solid #2a2a2a;
	}

	.last-updated {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 12px;
		font-weight: 600;
		color: #525252;
		text-align: center;
		margin: 0;
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

		.not-found-title {
			font-size: 24px;
		}

		.not-found-message {
			font-size: 14px;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.btn-back,
		.btn-add-section,
		.btn-save,
		.btn-back-to-list,
		.spinner {
			animation: none;
			transition: none;
		}

		.btn-back:hover,
		.btn-add-section:hover,
		.btn-save:hover,
		.btn-back-to-list:hover {
			transform: none;
		}
	}
</style>
