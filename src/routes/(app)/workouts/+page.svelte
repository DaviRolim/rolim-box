<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { listWoDs, deleteWoD, duplicateWoD } from '$lib/services/wod';
	import { toastStore } from '$lib/stores/toast.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
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

<!-- Duplicate Date Picker Modal -->
{#if duplicateModalOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={cancelDuplicate} role="dialog" aria-modal="true">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-accent"></div>
			<div class="modal-header">
				<h2 class="modal-title">Duplicate Workout</h2>
			</div>
			<div class="modal-body">
				<label for="duplicate-date" class="date-label">Select new date for workout:</label>
				<input
					type="date"
					id="duplicate-date"
					bind:value={duplicateDate}
					class="date-input"
					required
				/>
			</div>
			<div class="modal-actions">
				<button type="button" class="btn-cancel" onclick={cancelDuplicate}>Cancel</button>
				<button type="button" class="btn-confirm" onclick={confirmDuplicate}>Duplicate</button>
			</div>
		</div>
	</div>
{/if}

<div class="library-container">
	<!-- Header Section with Athletic Brutalism -->
	<header class="library-header">
		<div class="header-content">
			<div class="title-section">
				<div class="title-accent"></div>
				<h1 class="library-title">WORKOUTS</h1>
				<div class="title-underline"></div>
			</div>
			<button class="btn-new-wod" onclick={handleNewWod} aria-label="Create new workout">
				<span class="btn-icon">+</span>
				<span class="btn-text">New WoD</span>
			</button>
		</div>
	</header>

	<!-- Workouts List -->
	<div class="workouts-list">
		{#if !data.workspaceId}
			<!-- No Workspace State -->
			<div class="empty-state">
				<div class="empty-icon">⚠️</div>
				<h2 class="empty-title">No Workspace Found</h2>
				<p class="empty-description">Please create or join a workspace to manage workouts.</p>
			</div>
		{:else if isLoading}
			<!-- Loading Skeletons -->
			{#each Array(3) as _}
				<div class="wod-card-skeleton">
					<Skeleton variant="text" width="60%" height="24px" />
					<Skeleton variant="text" width="90%" height="18px" />
					<div class="skeleton-actions">
						<Skeleton variant="button" width="80px" height="44px" />
						<Skeleton variant="button" width="80px" height="44px" />
						<Skeleton variant="button" width="100px" height="44px" />
					</div>
				</div>
			{/each}
		{:else if wods.length === 0}
			<!-- Empty State -->
			<div class="empty-state">
				<div class="empty-icon">💪</div>
				<h2 class="empty-title">No workouts yet</h2>
				<p class="empty-description">Create your first workout to get started!</p>
				<button class="btn-empty-create" onclick={handleNewWod}>
					<span class="btn-icon">+</span>
					<span class="btn-text">Create Workout</span>
				</button>
			</div>
		{:else}
			<!-- Workout Cards -->
			{#each wods as wod (wod.id)}
				<article class="wod-card">
					<!-- Kinetic accent bar -->
					<div class="card-accent"></div>

					<!-- Date header -->
					<div class="card-header">
						<time class="card-date" datetime={wod.date}>
							{formatDate(wod.date)}
						</time>
						<span class="card-badge">
							{getSectionCount(wod.sections)} {getSectionCount(wod.sections) === 1
								? 'section'
								: 'sections'}
						</span>
					</div>

					<!-- Description -->
					<div class="card-body">
						<p class="card-description">
							{truncateDescription(wod.description)}
						</p>
					</div>

					<!-- Actions -->
					<div class="card-actions">
						<button
							class="action-btn action-view"
							onclick={() => handleView(wod.id)}
							aria-label="View workout"
						>
							<svg
								class="action-icon"
								width="18"
								height="18"
								viewBox="0 0 18 18"
								fill="none"
								stroke="currentColor"
							>
								<path
									d="M9 3C5 3 1.73 5.11 0 9c1.73 3.89 5 6 9 6s7.27-2.11 9-6c-1.73-3.89-5-6-9-6z"
									stroke-width="1.5"
									stroke-linecap="square"
								/>
								<circle cx="9" cy="9" r="2.5" stroke-width="1.5" />
							</svg>
							<span>View</span>
						</button>

						<button
							class="action-btn action-edit"
							onclick={() => handleEdit(wod.id)}
							aria-label="Edit workout"
						>
							<svg
								class="action-icon"
								width="18"
								height="18"
								viewBox="0 0 18 18"
								fill="none"
								stroke="currentColor"
							>
								<path
									d="M12.5 2.5l3 3-9 9H3.5v-3l9-9z"
									stroke-width="1.5"
									stroke-linecap="square"
								/>
							</svg>
							<span>Edit</span>
						</button>

						<button
							class="action-btn action-duplicate"
							onclick={() => handleDuplicateClick(wod.id)}
							aria-label="Duplicate workout"
						>
							<svg
								class="action-icon"
								width="18"
								height="18"
								viewBox="0 0 18 18"
								fill="none"
								stroke="currentColor"
							>
								<rect x="6" y="6" width="10" height="10" stroke-width="1.5" stroke-linecap="square" />
								<path
									d="M2 2h8v8"
									stroke-width="1.5"
									stroke-linecap="square"
									stroke-linejoin="miter"
								/>
							</svg>
							<span>Duplicate</span>
						</button>

						<button
							class="action-btn action-delete"
							onclick={() => handleDeleteClick(wod.id)}
							aria-label="Delete workout"
						>
							<svg
								class="action-icon"
								width="18"
								height="18"
								viewBox="0 0 18 18"
								fill="none"
								stroke="currentColor"
							>
								<path d="M3 5h12M7 5V3h4v2" stroke-width="1.5" stroke-linecap="square" />
								<path d="M6 5v10h6V5" stroke-width="1.5" stroke-linecap="square" />
								<path d="M8 8v4M10 8v4" stroke-width="1.5" stroke-linecap="square" />
							</svg>
							<span class="sr-only">Delete</span>
						</button>
					</div>
				</article>
			{/each}
		{/if}
	</div>
</div>

<style>
	/* ============================================================================
	   ATHLETIC BRUTALISM DESIGN SYSTEM
	   - Bold geometric shapes
	   - High contrast blacks with purple/pink accents
	   - Kinetic animated elements
	   - Sharp, precise typography
	   ============================================================================ */

	.library-container {
		min-height: 100vh;
		background: #0a0a0a;
		padding: 0 0 80px 0;
	}

	/* ===== HEADER ===== */
	.library-header {
		position: sticky;
		top: 0;
		z-index: 100;
		background: #0a0a0a;
		border-bottom: 3px solid #1a1a1a;
		padding: 24px 20px;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 20px;
	}

	.title-section {
		position: relative;
		flex: 1;
	}

	.title-accent {
		position: absolute;
		top: -8px;
		left: -4px;
		width: 60px;
		height: 4px;
		background: linear-gradient(90deg, #6e489f 0%, #e91e8c 100%);
		animation: accentPulse 2s ease-in-out infinite;
	}

	@keyframes accentPulse {
		0%,
		100% {
			opacity: 1;
			transform: scaleX(1);
		}
		50% {
			opacity: 0.7;
			transform: scaleX(1.2);
		}
	}

	.library-title {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 32px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #ffffff;
		margin: 0;
		line-height: 1;
		text-shadow: 0 0 30px rgba(110, 72, 159, 0.3);
	}

	.title-underline {
		margin-top: 8px;
		height: 2px;
		background: linear-gradient(90deg, #2a2a2a 0%, transparent 100%);
		width: 100%;
	}

	.btn-new-wod {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 24px;
		background: linear-gradient(135deg, #6e489f 0%, #5c3a87 100%);
		border: 2px solid #6e489f;
		color: #ffffff;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 4px 16px rgba(110, 72, 159, 0.4);
		position: relative;
		overflow: hidden;
		min-height: 48px;
	}

	.btn-new-wod::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
		transition: left 0.5s;
	}

	.btn-new-wod:hover::before {
		left: 100%;
	}

	.btn-new-wod:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(110, 72, 159, 0.5);
		border-color: #e91e8c;
	}

	.btn-new-wod:active {
		transform: translateY(0);
	}

	.btn-icon {
		font-size: 20px;
		font-weight: 700;
		line-height: 1;
	}

	.btn-text {
		line-height: 1;
	}

	/* ===== WORKOUTS LIST ===== */
	.workouts-list {
		padding: 24px 20px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	/* ===== WOD CARD ===== */
	.wod-card {
		background: #1a1a1a;
		border: 2px solid #2a2a2a;
		position: relative;
		overflow: hidden;
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.wod-card:hover {
		border-color: #3a3a3a;
		box-shadow: 0 8px 24px rgba(110, 72, 159, 0.15);
		transform: translateY(-2px);
	}

	/* Kinetic accent bar */
	.card-accent {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		background: linear-gradient(90deg, #6e489f 0%, #e91e8c 100%);
		animation: accentSlide 3s ease-in-out infinite;
	}

	@keyframes accentSlide {
		0%,
		100% {
			transform: translateX(0%);
			opacity: 1;
		}
		50% {
			transform: translateX(10%);
			opacity: 0.8;
		}
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 20px 12px 20px;
		gap: 12px;
		flex-wrap: wrap;
	}

	.card-date {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 18px;
		font-weight: 800;
		letter-spacing: -0.01em;
		color: #ffffff;
		text-transform: capitalize;
	}

	.card-badge {
		display: inline-flex;
		align-items: center;
		padding: 6px 12px;
		background: rgba(110, 72, 159, 0.15);
		border: 1px solid #6e489f;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #8b7ab8;
	}

	.card-body {
		padding: 0 20px 16px 20px;
	}

	.card-description {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 400;
		line-height: 1.6;
		color: #a3a3a3;
		margin: 0;
	}

	.card-actions {
		display: flex;
		gap: 8px;
		padding: 16px 20px 20px 20px;
		border-top: 1px solid #2a2a2a;
		background: #0a0a0a;
		flex-wrap: wrap;
	}

	.action-btn {
		flex: 1;
		min-width: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 16px;
		background: transparent;
		border: 2px solid #2a2a2a;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #737373;
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		min-height: 44px;
	}

	.action-btn:hover {
		border-color: #3a3a3a;
		background: #2a2a2a;
		color: #ffffff;
		transform: translateY(-1px);
	}

	.action-btn:active {
		transform: translateY(0);
	}

	.action-btn:focus-visible {
		outline: 2px solid #6e489f;
		outline-offset: 2px;
	}

	.action-icon {
		flex-shrink: 0;
	}

	.action-view:hover {
		border-color: #6e489f;
		color: #6e489f;
		background: rgba(110, 72, 159, 0.1);
	}

	.action-edit:hover {
		border-color: #e91e8c;
		color: #e91e8c;
		background: rgba(233, 30, 140, 0.1);
	}

	.action-duplicate:hover {
		border-color: #8b7ab8;
		color: #8b7ab8;
		background: rgba(139, 122, 184, 0.1);
	}

	.action-delete {
		flex: 0;
		padding: 12px;
	}

	.action-delete:hover {
		border-color: #ef4444;
		color: #ef4444;
		background: rgba(239, 68, 68, 0.1);
	}

	/* ===== EMPTY STATE ===== */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80px 20px;
		text-align: center;
	}

	.empty-icon {
		font-size: 64px;
		margin-bottom: 24px;
		opacity: 0.3;
		filter: grayscale(1);
	}

	.empty-title {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 24px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: #ffffff;
		margin: 0 0 12px 0;
	}

	.empty-description {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 400;
		color: #737373;
		margin: 0 0 32px 0;
	}

	.btn-empty-create {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 16px 32px;
		background: linear-gradient(135deg, #6e489f 0%, #5c3a87 100%);
		border: 2px solid #6e489f;
		color: #ffffff;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 4px 16px rgba(110, 72, 159, 0.4);
		min-height: 48px;
	}

	.btn-empty-create:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(110, 72, 159, 0.5);
		border-color: #e91e8c;
	}

	.btn-empty-create:active {
		transform: translateY(0);
	}

	/* ===== LOADING SKELETONS ===== */
	.wod-card-skeleton {
		background: #1a1a1a;
		border: 2px solid #2a2a2a;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.skeleton-actions {
		display: flex;
		gap: 8px;
		padding-top: 16px;
		border-top: 1px solid #2a2a2a;
	}

	/* ===== DUPLICATE MODAL ===== */
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(10, 10, 10, 0.85);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		animation: fadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.modal-content {
		background: #1a1a1a;
		border: 2px solid #2a2a2a;
		width: 100%;
		max-width: 440px;
		position: relative;
		overflow: hidden;
		animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.modal-accent {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 6px;
		background: linear-gradient(90deg, #6e489f 0%, #e91e8c 100%);
		animation: accentPulse 2s ease-in-out infinite;
	}

	.modal-header {
		padding: 32px 24px 16px 24px;
	}

	.modal-title {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 24px;
		font-weight: 800;
		letter-spacing: -0.02em;
		text-transform: uppercase;
		color: #ffffff;
		margin: 0;
	}

	.modal-body {
		padding: 0 24px 24px 24px;
	}

	.date-label {
		display: block;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #a3a3a3;
		margin-bottom: 12px;
	}

	.date-input {
		width: 100%;
		padding: 14px 16px;
		background: #0a0a0a;
		border: 2px solid #2a2a2a;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 15px;
		font-weight: 600;
		color: #ffffff;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		min-height: 48px;
	}

	.date-input:hover {
		border-color: #3a3a3a;
	}

	.date-input:focus {
		outline: none;
		border-color: #6e489f;
		background: #1a1a1a;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		padding: 20px 24px 24px 24px;
		background: #0a0a0a;
		border-top: 1px solid #2a2a2a;
	}

	.btn-cancel,
	.btn-confirm {
		flex: 1;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 16px 24px;
		border: 2px solid;
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
		overflow: hidden;
		min-height: 48px;
	}

	.btn-cancel {
		background: transparent;
		border-color: #2a2a2a;
		color: #a3a3a3;
	}

	.btn-cancel:hover {
		background: #2a2a2a;
		border-color: #3a3a3a;
		color: #ffffff;
		transform: translateY(-1px);
	}

	.btn-confirm {
		background: linear-gradient(135deg, #6e489f 0%, #5c3a87 100%);
		border-color: #6e489f;
		color: #ffffff;
		box-shadow: 0 4px 12px rgba(110, 72, 159, 0.3);
	}

	.btn-confirm:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(110, 72, 159, 0.4);
	}

	/* ===== RESPONSIVE DESIGN ===== */
	@media (max-width: 640px) {
		.library-header {
			padding: 20px 16px;
		}

		.library-title {
			font-size: 24px;
		}

		.btn-new-wod {
			padding: 12px 20px;
		}

		.btn-text {
			display: none;
		}

		.btn-icon {
			font-size: 24px;
		}

		.workouts-list {
			padding: 20px 16px;
		}

		.card-actions {
			flex-wrap: wrap;
		}

		.action-btn span:not(.sr-only) {
			display: none;
		}

		.action-btn {
			flex: 0;
			padding: 12px;
		}

		.action-duplicate {
			flex: 0;
		}

		.modal-actions {
			flex-direction: column;
		}

		.btn-cancel,
		.btn-confirm {
			width: 100%;
		}
	}

	/* ===== ACCESSIBILITY ===== */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	/* ===== REDUCED MOTION ===== */
	@media (prefers-reduced-motion: reduce) {
		.card-accent,
		.title-accent,
		.modal-accent {
			animation: none;
		}

		.btn-new-wod::before {
			display: none;
		}

		.wod-card,
		.action-btn,
		.btn-new-wod,
		.btn-empty-create,
		.btn-cancel,
		.btn-confirm {
			transition: none;
		}

		.wod-card:hover,
		.action-btn:hover,
		.btn-new-wod:hover,
		.btn-empty-create:hover,
		.btn-confirm:hover {
			transform: none;
		}
	}
</style>
