<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { listWoDs, deleteWoD, duplicateWoD } from '$lib/services/wod';
	import { toastStore } from '$lib/stores/toast.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { PageData } from './$types';
	import type { WoD } from '$lib/types/wod';

	let { data }: { data: PageData } = $props();

	// State management
	let wods = $state<WoD[]>([]);
	let isLoading = $state(true);
	let deleteModalOpen = $state(false);
	let duplicateModalOpen = $state(false);
	let selectedWodId = $state<string | null>(null);
	let duplicateDate = $state(new Date().toISOString().split('T')[0]);

	onMount(async () => {
		if (data.workspaceId) {
			try {
				wods = await listWoDs(data.workspaceId);
			} catch (error) {
				console.error('Failed to load workouts:', error);
				toastStore.error('Failed to load workouts');
			}
		}
		isLoading = false;
	});

	// Format date in a human-readable way
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// Truncate description for preview
	function truncateDescription(description: string | null): string {
		if (!description) return 'No description';
		return description.length > 100 ? description.slice(0, 100) + '...' : description;
	}

	// Get section count
	function getSectionCount(sections: any[]): number {
		return sections.length;
	}

	// Handle delete workflow
	function handleDeleteClick(wodId: string) {
		selectedWodId = wodId;
		deleteModalOpen = true;
	}

	async function confirmDelete() {
		if (!selectedWodId) return;

		try {
			await deleteWoD(selectedWodId);
			// Reload from service
			if (data.workspaceId) {
				wods = await listWoDs(data.workspaceId);
			}
			toastStore.success('Workout deleted successfully');
		} catch (error) {
			console.error('Failed to delete workout:', error);
			toastStore.error('Failed to delete workout');
		} finally {
			deleteModalOpen = false;
			selectedWodId = null;
		}
	}

	function cancelDelete() {
		deleteModalOpen = false;
		selectedWodId = null;
	}

	// Handle duplicate workflow
	function handleDuplicateClick(wodId: string) {
		selectedWodId = wodId;
		duplicateDate = new Date().toISOString().split('T')[0];
		duplicateModalOpen = true;
	}

	async function confirmDuplicate() {
		if (!selectedWodId) return;

		try {
			await duplicateWoD(selectedWodId, duplicateDate);
			// Reload from service instead of navigation
			if (data.workspaceId) {
				wods = await listWoDs(data.workspaceId);
			}
			toastStore.success('Workout duplicated successfully');
		} catch (error) {
			console.error('Failed to duplicate workout:', error);
			toastStore.error('Failed to duplicate workout');
		} finally {
			duplicateModalOpen = false;
			selectedWodId = null;
		}
	}

	function cancelDuplicate() {
		duplicateModalOpen = false;
		selectedWodId = null;
	}

	// Navigation handlers
	function handleView(wodId: string) {
		goto(`/workouts/${wodId}`);
	}

	function handleEdit(wodId: string) {
		goto(`/workouts/${wodId}/edit`);
	}

	function handleNewWod() {
		goto('/workouts/new');
	}
</script>

<Toast />

<!-- Delete Confirmation Modal -->
<ConfirmModal
	bind:open={deleteModalOpen}
	title="Delete Workout"
	message="Are you sure you want to delete this workout? This action cannot be undone."
	confirmText="Delete"
	cancelText="Cancel"
	variant="danger"
	onConfirm={confirmDelete}
	onCancel={cancelDelete}
/>

{#if duplicateModalOpen}
	<div class="fixed inset-0 z-[1000] flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 h-full w-full cursor-default bg-bg-base/80 backdrop-blur-sm"
			onclick={cancelDuplicate}
			aria-label="Close modal"
		></button>
		<Card class="relative w-full max-w-sm border-accent-500/20 shadow-2xl shadow-black">
			<div class="space-y-6">
				<div class="space-y-2">
					<h3 class="text-xl font-black tracking-tight text-white uppercase">Duplicate WOD</h3>
					<p class="text-sm text-text-muted">Choose a new date for this workout.</p>
				</div>

				<div class="space-y-2">
					<label
						for="dup-date"
						class="text-[10px] font-bold tracking-widest text-accent-400 uppercase"
						>Target Date</label
					>
					<input
						type="date"
						id="dup-date"
						bind:value={duplicateDate}
						class="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-white outline-none focus:border-accent-500/50"
					/>
				</div>

				<div class="flex gap-3 pt-2">
					<Button variant="secondary" class="flex-1" onclick={cancelDuplicate}>CANCEL</Button>
					<Button variant="primary" class="flex-1" onclick={confirmDuplicate}>DUPLICATE</Button>
				</div>
			</div>
		</Card>
	</div>
{/if}

<div class="flex flex-col gap-8 p-4 pb-24 md:p-6">
	<!-- Header Section -->
	<header class="flex items-end justify-between border-b border-white/10 pb-4">
		<div>
			<h1
				class="bg-gradient-to-r from-white to-white/50 bg-clip-text text-3xl font-black tracking-tight text-transparent uppercase"
			>
				Workouts
			</h1>
			<div class="h-1 w-16 bg-gradient-to-r from-accent-500 to-primary-500"></div>
		</div>
		<Button
			variant="primary"
			size="sm"
			onclick={handleNewWod}
			class="shadow-lg shadow-accent-500/20"
		>
			<svg
				class="mr-2 h-4 w-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
			>
				<path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
			NEW WOD
		</Button>
	</header>

	<!-- Workouts List -->
	<div class="flex flex-col gap-4">
		{#if !data.workspaceId}
			<Card
				class="flex flex-col items-center justify-center gap-4 border-dashed border-white/10 bg-transparent py-12 text-center"
			>
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-error">
					<svg
						class="h-8 w-8"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="8" x2="12" y2="12" />
						<line x1="12" y1="16" x2="12.01" y2="16" />
					</svg>
				</div>
				<div class="space-y-1">
					<h2 class="text-xl font-bold text-white">No Workspace Found</h2>
					<p class="mx-auto max-w-xs text-sm text-text-muted">
						Please create or join a workspace to manage workouts.
					</p>
				</div>
			</Card>
		{:else if isLoading}
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each Array(4) as _}
					<Card class="space-y-4">
						<div class="flex items-start justify-between">
							<Skeleton variant="text" height="1.5rem" width="40%" />
							<Skeleton variant="text" height="1rem" width="20%" />
						</div>
						<Skeleton variant="text" height="1rem" width="100%" />
						<div class="flex gap-2 pt-2">
							<Skeleton variant="button" width="80px" height="36px" />
							<Skeleton variant="button" width="80px" height="36px" />
						</div>
					</Card>
				{/each}
			</div>
		{:else if wods.length === 0}
			<Card
				class="flex flex-col items-center justify-center gap-6 border-dashed border-white/10 bg-transparent py-16 text-center"
			>
				<div class="relative">
					<div class="absolute inset-0 rounded-full bg-accent-500/20 blur-2xl"></div>
					<div
						class="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-text-muted"
					>
						<svg
							class="h-10 w-10"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
							<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
						</svg>
					</div>
				</div>
				<div class="space-y-1">
					<h2 class="text-xl font-bold text-white">No workouts yet</h2>
					<p class="text-sm text-text-muted">
						Your training library is empty. Start your journey today!
					</p>
				</div>
				<Button variant="outline" size="sm" onclick={handleNewWod}>CREATE FIRST WOD</Button>
			</Card>
		{:else}
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each wods as wod (wod.id)}
					<Card
						class="group relative overflow-hidden border-l-2 border-l-transparent transition-all duration-300 hover:border-l-accent-500"
					>
						<div class="flex flex-col gap-4">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									<div
										class="flex h-10 w-10 items-center justify-center rounded-lg border border-white/5 bg-bg-surface font-bold text-accent-400"
									>
										{new Date(wod.date).getDate()}
									</div>
									<div>
										<h3 class="font-bold tracking-tight text-text-primary uppercase">
											{new Date(wod.date).toLocaleDateString('en-US', {
												month: 'short',
												year: 'numeric'
											})}
										</h3>
										<p
											class="text-[10px] leading-none font-bold tracking-widest text-text-muted uppercase"
										>
											{new Date(wod.date).toLocaleDateString('en-US', { weekday: 'long' })}
										</p>
									</div>
								</div>
								<div
									class="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-[10px] font-bold tracking-widest text-text-secondary uppercase"
								>
									{getSectionCount(wod.sections)}
									{getSectionCount(wod.sections) === 1 ? 'Section' : 'Sections'}
								</div>
							</div>

							<p class="line-clamp-2 text-sm leading-relaxed text-text-secondary">
								{truncateDescription(wod.description)}
							</p>

							<div class="mt-auto flex items-center justify-between border-t border-white/5 pt-2">
								<div class="flex gap-2">
									<Button
										variant="secondary"
										size="xs"
										onclick={() => handleView(wod.id)}
										class="text-[10px]">VIEW</Button
									>
									<Button
										variant="outline"
										size="xs"
										onclick={() => handleEdit(wod.id)}
										class="text-[10px]">EDIT</Button
									>
								</div>
								<div class="flex gap-1">
									<button
										class="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/5 hover:text-accent-400"
										onclick={() => handleDuplicateClick(wod.id)}
										title="Duplicate"
									>
										<svg
											class="h-4 w-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
											<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
										</svg>
									</button>
									<button
										class="rounded-lg p-2 text-text-muted transition-colors hover:bg-error/5 hover:text-error"
										onclick={() => handleDeleteClick(wod.id)}
										title="Delete"
									>
										<svg
											class="h-4 w-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<polyline points="3 6 5 6 21 6" />
											<path
												d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
											/>
										</svg>
									</button>
								</div>
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{/if}
	</div>
</div>
