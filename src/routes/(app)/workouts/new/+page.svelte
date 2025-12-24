<script lang="ts">
	import { goto, beforeNavigate } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import SectionList from '$lib/components/sections/SectionList.svelte';
	import AddSectionForm from '$lib/components/sections/AddSectionForm.svelte';
	import EditSectionForm from '$lib/components/sections/EditSectionForm.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { createWoD } from '$lib/services/wod';
	import type { Section, SectionType } from '$lib/types/wod';
	import type { TimerConfig } from '$lib/types/timer';
	import type { PageData } from './$types';
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
	function handleAddSection(sectionData: {
		type: SectionType;
		name: string;
		content: string;
		timerConfig: string | null;
	}) {
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
	function handleSaveSection(updates: {
		type: SectionType;
		name: string;
		content: string;
		timerConfig: string | null;
	}) {
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
			const confirmed = confirm('You have unsaved changes. Are you sure you want to cancel?');
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
			sections = data.sections.map(
				(
					section: {
						type: SectionType;
						name: string;
						content: string;
						order: number;
						timerConfig: string | null;
					},
					index: number
				) => ({
					id: `temp-${Date.now()}-${index}`,
					wodId: '',
					type: section.type,
					name: section.name,
					content: section.content,
					order: index,
					timerConfig: section.timerConfig
				})
			);

			toastStore.success('Sections generated successfully');
		} catch (error) {
			console.error('Failed to generate sections:', error);
			toastStore.error(
				error instanceof Error ? error.message : 'Failed to generate sections. Please try again.'
			);
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

``````
<Toast />

<ConfirmModal
	bind:open={showReplaceConfirm}
	title="Replace Sections?"
	message="This will replace your existing {sections.length} section{sections.length === 1
		? ''
		: 's'}. Are you sure you want to continue?"
	confirmText="Replace"
	cancelText="Cancel"
	variant="default"
	onConfirm={confirmReplace}
	onCancel={cancelReplaceConfirm}
/>

<div class="flex flex-col gap-8 p-4 pb-24 md:p-6 lg:mx-auto lg:max-w-5xl">
	<!-- Header Section -->
	<header class="flex items-center justify-between border-b border-white/10 pb-4">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="sm" onclick={handleCancel} class="p-2">
				<svg
					class="h-5 w-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</Button>
			<div>
				<h1
					class="bg-gradient-to-r from-white to-white/50 bg-clip-text text-3xl font-black tracking-tight text-transparent uppercase"
				>
					New WOD
				</h1>
				<div class="h-1 w-12 bg-gradient-to-r from-accent-500 to-primary-500"></div>
			</div>
		</div>
		<Button
			variant="primary"
			size="sm"
			onclick={handleSave}
			disabled={isSaving}
			class="px-6 shadow-lg shadow-accent-500/20"
		>
			{#if isSaving}
				<div
					class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"
				></div>
				SAVING...
			{:else}
				<svg
					class="mr-2 h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
				>
					<path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				SAVE WOD
			{/if}
		</Button>
	</header>

	<!-- Main Form -->
	<div class="grid grid-cols-1 gap-8">
		<!-- Configuration Card -->
		<Card class="space-y-6">
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<!-- Date input -->
				<div class="space-y-2">
					<label
						class="text-[10px] font-bold tracking-widest text-accent-400 uppercase"
						for="workout-date">Workout Date</label
					>
					<div class="group relative">
						<input
							id="workout-date"
							type="date"
							class="w-full rounded-xl border bg-white/5 p-4 text-white transition-all outline-none group-hover:bg-white/10 focus:border-accent-500/50 focus:bg-white/10 {dateError
								? 'border-error/50'
								: 'border-white/5'}"
							bind:value={date}
						/>
						{#if dateError}
							<p class="mt-1 text-[10px] font-bold tracking-wider text-error uppercase">
								{dateError}
							</p>
						{/if}
					</div>
				</div>

				<!-- Workspace Info (Read-only aesthetic) -->
				<div class="space-y-2 opacity-60">
					<span class="text-[10px] font-bold tracking-widest text-text-muted uppercase"
						>Target Workspace</span
					>
					<div class="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
						<div
							class="flex h-6 w-6 items-center justify-center rounded-full bg-accent-500/20 text-accent-400"
						>
							<svg
								class="h-3 w-3"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="3"
							>
								<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
							</svg>
						</div>
						<span class="text-xs font-bold tracking-tight text-white uppercase"
							>{data.workspaceId.slice(0, 8)}...</span
						>
					</div>
				</div>
			</div>

			<!-- Description textarea -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<label
						class="text-[10px] font-bold tracking-widest text-accent-400 uppercase"
						for="workout-description">Quick Description</label
					>
					<span class="text-[10px] font-medium text-text-muted">{description.length}/500</span>
				</div>
				<div class="group relative">
					<textarea
						id="workout-description"
						class="min-h-[100px] w-full rounded-xl border bg-white/5 p-4 text-white transition-all outline-none group-hover:bg-white/10 focus:border-accent-500/50 focus:bg-white/10 {descriptionError
							? 'border-error/50'
							: 'border-white/5'}"
						bind:value={description}
						placeholder="E.g. Full body metabolic conditioning focus..."
						maxlength="500"
						rows="3"
					></textarea>

					{#if description.length >= 5}
						<button
							type="button"
							class="absolute right-3 bottom-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600 text-white shadow-lg transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
							onclick={generateSections}
							disabled={isGenerating || isSaving}
							title="AI Intelligence"
						>
							{#if isGenerating}
								<div
									class="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"
								></div>
							{:else}
								<svg
									class="h-5 w-5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
								>
									<path
										d="M12 2v4m0 14v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m14 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"
										stroke-linecap="round"
									/>
								</svg>
							{/if}
						</button>
					{/if}
				</div>
				{#if descriptionError}
					<p class="mt-1 text-[10px] font-bold tracking-wider text-error uppercase">
						{descriptionError}
					</p>
				{/if}
				<p class="text-[10px] text-text-muted italic">
					Type a description and use the sparkles to generate a full workout structure using AI.
				</p>
			</div>
		</Card>

		<!-- Sections List -->
		<div class="space-y-6">
			<div class="flex items-center justify-between gap-4">
				<div>
					<h2 class="text-xl font-black tracking-tight text-white uppercase">Workout Structure</h2>
					<p class="text-[10px] font-bold tracking-widest text-accent-400 uppercase">
						{sections.length}
						{sections.length === 1 ? 'Section' : 'Sections'} planned
					</p>
				</div>
			</div>

			<div class="space-y-4">
				{#if editingSection}
					<div class="animate-in fade-in slide-in-from-top-4 duration-300">
						<EditSectionForm
							section={editingSection}
							onSave={handleSaveSection}
							onCancel={handleCancelEdit}
						/>
					</div>
				{:else}
					<SectionList
						{sections}
						editable={true}
						onReorder={handleReorder}
						onEdit={handleEditSection}
						onDelete={handleDeleteSection}
					/>

					{#if showAddForm}
						<div class="animate-in fade-in slide-in-from-top-4 duration-300">
							<AddSectionForm onAdd={handleAddSection} onCancel={handleCancelAdd} />
						</div>
					{:else}
						<button
							type="button"
							class="group relative w-full overflow-hidden rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 transition-all hover:border-accent-500/50 hover:bg-white/10"
							onclick={() => (showAddForm = true)}
						>
							<div class="flex flex-col items-center justify-center gap-3">
								<div
									class="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-text-muted transition-all group-hover:bg-accent-500/20 group-hover:text-accent-400"
								>
									<svg
										class="h-6 w-6"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="3"
									>
										<path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								</div>
								<span
									class="text-xs font-black tracking-widest text-text-muted uppercase transition-colors group-hover:text-white"
									>Add Section</span
								>
							</div>
						</button>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Bottom Actions -->
		<div class="mt-8 flex flex-col gap-4 md:flex-row md:justify-center">
			<Button
				variant="primary"
				class="w-full py-4 shadow-xl shadow-accent-500/20 md:w-auto md:px-12"
				onclick={handleSave}
				disabled={isSaving}
			>
				{#if isSaving}
					<div
						class="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"
					></div>
					SAVING WORKOUT...
				{:else}
					COMPLETE & SAVE WOD
				{/if}
			</Button>
		</div>
	</div>
</div>
