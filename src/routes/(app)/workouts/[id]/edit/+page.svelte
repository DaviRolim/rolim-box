<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import SectionList from '$lib/components/sections/SectionList.svelte';
	import AddSectionForm from '$lib/components/sections/AddSectionForm.svelte';
	import EditSectionForm from '$lib/components/sections/EditSectionForm.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
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
					order: s.order,
					timerConfig: s.timerConfig
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
					order: s.order,
					timerConfig: s.timerConfig
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
	function handleAddSection(sectionData: {
		type: SectionType;
		name: string;
		content: string;
		timerConfig: string | null;
	}) {
		const newSection: Section = {
			id: `temp-${Date.now()}-${Math.random()}`,
			wodId: data.wodId,
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

<div class="flex flex-col gap-8 p-4 pb-24 md:p-6 lg:mx-auto lg:max-w-5xl">
	{#if isLoading}
		<!-- Loading State -->
		<div class="space-y-6">
			<div class="flex items-center justify-between">
				<div class="space-y-2">
					<Skeleton variant="text" width="100px" height="20px" />
					<Skeleton variant="text" width="200px" height="32px" />
				</div>
				<Skeleton variant="button" width="100px" height="40px" />
			</div>

			<Card class="space-y-4">
				<Skeleton variant="text" width="100%" height="48px" />
				<Skeleton variant="text" width="100%" height="100px" />
			</Card>
		</div>
	{:else if notFound}
		<!-- 404 State -->
		<div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
			<div
				class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-4xl text-text-muted"
			>
				🔍
			</div>
			<h1 class="mb-2 text-2xl font-black tracking-tight text-white uppercase">
				Workout Not Found
			</h1>
			<p class="mb-8 max-w-md text-text-secondary">
				The workout you're looking for doesn't exist or has been deleted.
			</p>
			<Button variant="primary" onclick={() => goto('/workouts')}>Back to Workouts</Button>
		</div>
	{:else}
		<!-- Header -->
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
						Edit Workout
					</h1>
					<div class="h-1 w-12 bg-gradient-to-r from-accent-500 to-primary-500"></div>
				</div>
			</div>
			<Button
				variant="primary"
				size="sm"
				onclick={handleSave}
				disabled={isSaving}
				class="px-3 shadow-lg shadow-accent-500/20 sm:px-6"
			>
				{#if isSaving}
					<div
						class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"
					></div>
					<span class="sm:hidden">SAVING</span>
					<span class="hidden sm:inline">SAVING...</span>
				{:else}
					<svg
						class="mr-1.5 h-4 w-4 sm:mr-2"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
					>
						<path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					<span class="sm:hidden">SAVE</span>
					<span class="hidden sm:inline">SAVE CHANGES</span>
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
							for="workout-date">Date</label
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
				</div>

				<!-- Description textarea -->
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<label
							class="text-[10px] font-bold tracking-widest text-accent-400 uppercase"
							for="workout-description">Description (optional)</label
						>
						<span class="text-[10px] font-medium text-text-muted">{description.length}/500</span>
					</div>
					<textarea
						id="workout-description"
						class="min-h-[100px] w-full rounded-xl border bg-white/5 p-4 text-white transition-all outline-none focus:border-accent-500/50 focus:bg-white/10 {descriptionError
							? 'border-error/50'
							: 'border-white/5'}"
						bind:value={description}
						placeholder="Add a brief description of the workout..."
						maxlength="500"
						rows="3"
					></textarea>
					{#if descriptionError}
						<p class="mt-1 text-[10px] font-bold tracking-wider text-error uppercase">
							{descriptionError}
						</p>
					{/if}
				</div>
			</Card>

			<!-- Sections List -->
			<div class="space-y-6">
				<div class="flex items-center justify-between gap-4">
					<div>
						<h2 class="text-xl font-black tracking-tight text-white uppercase">
							Workout Structure
						</h2>
						<p class="text-[10px] font-bold tracking-widest text-accent-400 uppercase">
							{sections.length}
							{sections.length === 1 ? 'Section' : 'Sections'}
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
						SAVING...
					{:else}
						SAVE CHANGES
					{/if}
				</Button>
			</div>

			<!-- Last updated timestamp -->
			{#if lastUpdated && !hasUnsavedChanges}
				<footer class="text-center">
					<p class="text-[10px] font-medium text-text-muted">
						Last updated: {formatUpdatedDate(lastUpdated)}
					</p>
				</footer>
			{/if}
		</div>
	{/if}
</div>
