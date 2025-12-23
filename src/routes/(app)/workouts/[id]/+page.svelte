<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getWoD } from '$lib/services/wod';
	import { sectionTypes } from '$lib/config/section-types';
	import { toastStore } from '$lib/stores/toast.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import type { PageData } from './$types';
	import type { WoD } from '$lib/types/wod';
	import { parseTimerConfig, TIMER_LABELS, formatTime } from '$lib/types/timer';

	let { data }: { data: PageData } = $props();

	// State
	let wod = $state<WoD | null>(null);
	let isLoading = $state(true);
	let notFound = $state(false);

	onMount(async () => {
		try {
			const loadedWod = await getWoD(data.wodId);
			if (loadedWod) {
				wod = loadedWod;
			} else {
				notFound = true;
				toastStore.error('Workout not found');
			}
		} catch (error) {
			console.error('Failed to load workout:', error);
			toastStore.error('Failed to load workout');
			notFound = true;
		} finally {
			isLoading = false;
		}
	});

	// Format date in a human-readable way
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// Navigation handlers
	function handleBack() {
		goto('/workouts');
	}

	function handleEdit() {
		if (wod) {
			goto(`/workouts/${wod.id}/edit`);
		}
	}

	// Get section type styling
	function getSectionTypeColor(type: string): string {
		const colors: Record<string, string> = {
			warmup: '#f97316',
			skill: '#3b82f6',
			wod: '#e91e8c',
			cooldown: '#06b6d4',
			stretches: '#a855f7',
			custom: '#6b7280'
		};
		return colors[type] || colors.custom;
	}
</script>

<Toast />

<div class="view-container">
	{#if isLoading}
		<!-- Loading State -->
		<div class="view-header">
			<Skeleton variant="button" width="100px" height="48px" />
			<Skeleton variant="text" width="150px" height="24px" />
			<Skeleton variant="button" width="100px" height="48px" />
		</div>
		<div class="view-content">
			<Skeleton variant="text" width="90%" height="32px" />
			<Skeleton variant="text" width="80%" height="32px" />
			<div class="skeleton-sections">
				{#each Array(2) as _}
					<div class="section-skeleton">
						<Skeleton variant="text" width="150px" height="28px" />
						<Skeleton variant="text" count={3} />
					</div>
				{/each}
			</div>
		</div>
	{:else if notFound || !wod}
		<!-- 404 State -->
		<div class="not-found-container">
			<div class="not-found-content">
				<div class="not-found-icon">🔍</div>
				<h1 class="not-found-title">Workout Not Found</h1>
				<p class="not-found-description">
					The workout you're looking for doesn't exist or has been deleted.
				</p>
				<button class="btn-back-to-library" onclick={handleBack}>
					<svg class="btn-icon-svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path
							d="M12 4L6 10L12 16"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="square"
							stroke-linejoin="miter"
						/>
					</svg>
					<span>Back to Library</span>
				</button>
			</div>
		</div>
	{:else}
		<!-- WoD View -->
		<header class="view-header">
			<button class="btn-back" onclick={handleBack} aria-label="Back to workouts">
				<svg class="back-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
					<path
						d="M15 6L9 12L15 18"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="square"
						stroke-linejoin="miter"
					/>
				</svg>
				<span class="back-text">Back</span>
			</button>

			<time class="header-date" datetime={wod.date}>
				{formatDate(wod.date)}
			</time>

			<button class="btn-edit" onclick={handleEdit} aria-label="Edit workout">
				<svg class="edit-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
					<path
						d="M14 3l3 3-10 10H4v-3L14 3z"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="square"
					/>
				</svg>
				<span class="edit-text">Edit</span>
			</button>
		</header>

		<div class="view-content">
			<!-- Description Section -->
			{#if wod.description}
				<div class="description-container">
					<div class="description-accent"></div>
					<p class="description-text">{wod.description}</p>
				</div>
			{/if}

			<!-- Sections -->
			<div class="sections-container">
				{#each wod.sections as section (section.id)}
					{@const timerConfig = parseTimerConfig(section.timerConfig)}
					<article class="section-card" style="--section-color: {getSectionTypeColor(section.type)}">
						<!-- Section header with type badge -->
						<div class="section-header">
							<div class="section-type-badge">
								<span class="section-icon">{sectionTypes[section.type].icon}</span>
								<span class="section-type-label">{sectionTypes[section.type].label}</span>
							</div>
							<h2 class="section-name">{section.name}</h2>
						</div>

						<!-- Section divider -->
						<div class="section-divider"></div>

						<!-- Section content -->
						<div class="section-content">
							<pre class="section-text">{section.content}</pre>
						</div>

						<!-- Timer button -->
						<div class="section-footer">
							{#if timerConfig}
								<a
									href="/timer/{section.id}?wod={wod.id}"
									class="btn-timer-active"
								>
									<svg class="timer-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
										<circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" />
										<path d="M10 6v4l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="square" />
									</svg>
									<span class="timer-text">{TIMER_LABELS[timerConfig.type]}</span>
									<span class="timer-config-text">
										{#if timerConfig.type === 'amrap' || timerConfig.type === 'fortime'}
											{formatTime(timerConfig.duration!)}
										{:else if timerConfig.type === 'emom'}
											{timerConfig.rounds}x{timerConfig.intervalWork}s
										{:else if timerConfig.type === 'tabata'}
											{timerConfig.rounds}x {timerConfig.intervalWork}s/{timerConfig.intervalRest}s
										{/if}
									</span>
								</a>
							{:else}
								<span class="no-timer-text">No timer configured</span>
							{/if}
						</div>
					</article>
				{/each}
			</div>

			<!-- Empty sections state -->
			{#if wod.sections.length === 0}
				<div class="empty-sections">
					<div class="empty-icon">📝</div>
					<p class="empty-text">No sections in this workout.</p>
					<button class="btn-edit-workout" onclick={handleEdit}>
						<span>Add Sections</span>
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* ============================================================================
	   WOD VIEW PAGE - ATHLETIC BRUTALISM
	   Distinctive design philosophy:
	   - Bold geometric section cards with colored accent borders
	   - Monospaced content display for authentic workout notation
	   - Kinetic header with powerful back/edit controls
	   - High-contrast section type badges with custom color theming
	   - Industrial typography with precise spacing
	   ============================================================================ */

	.view-container {
		min-height: 100vh;
		background: #0a0a0a;
		padding-bottom: 80px;
	}

	/* ===== HEADER WITH NAVIGATION ===== */
	.view-header {
		position: sticky;
		top: 0;
		z-index: 100;
		background: #0a0a0a;
		border-bottom: 3px solid #1a1a1a;
		padding: 20px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}

	.btn-back {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		background: transparent;
		border: 2px solid #2a2a2a;
		color: #a3a3a3;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		min-height: 48px;
	}

	.btn-back:hover {
		border-color: #6e489f;
		color: #6e489f;
		background: rgba(110, 72, 159, 0.1);
		transform: translateX(-2px);
	}

	.back-icon {
		flex-shrink: 0;
	}

	.header-date {
		flex: 1;
		text-align: center;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 16px;
		font-weight: 800;
		letter-spacing: -0.01em;
		text-transform: uppercase;
		color: #ffffff;
		text-shadow: 0 0 20px rgba(110, 72, 159, 0.3);
	}

	.btn-edit {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		background: linear-gradient(135deg, #6e489f 0%, #5c3a87 100%);
		border: 2px solid #6e489f;
		color: #ffffff;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 4px 12px rgba(110, 72, 159, 0.4);
		min-height: 48px;
	}

	.btn-edit:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(110, 72, 159, 0.5);
		border-color: #e91e8c;
	}

	.btn-edit:active {
		transform: translateY(0);
	}

	.edit-icon {
		flex-shrink: 0;
	}

	/* ===== CONTENT AREA ===== */
	.view-content {
		padding: 24px 20px;
		max-width: 800px;
		margin: 0 auto;
	}

	/* ===== DESCRIPTION ===== */
	.description-container {
		position: relative;
		margin-bottom: 32px;
		padding: 24px;
		background: #1a1a1a;
		border: 2px solid #2a2a2a;
		border-left: 6px solid #6e489f;
	}

	.description-accent {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, #6e489f 0%, #e91e8c 50%, #6e489f 100%);
		background-size: 200% 100%;
		animation: accentFlow 4s ease-in-out infinite;
	}

	@keyframes accentFlow {
		0%,
		100% {
			background-position: 0% 0%;
			opacity: 1;
		}
		50% {
			background-position: 100% 0%;
			opacity: 0.7;
		}
	}

	.description-text {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 18px;
		font-weight: 600;
		line-height: 1.6;
		color: #ffffff;
		margin: 0;
		letter-spacing: -0.01em;
	}

	/* ===== SECTIONS CONTAINER ===== */
	.sections-container {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	/* ===== SECTION CARD - DISTINCTIVE DESIGN ===== */
	.section-card {
		position: relative;
		background: #1a1a1a;
		border: 3px solid var(--section-color);
		overflow: hidden;
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.section-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 6px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			var(--section-color) 50%,
			transparent 100%
		);
		opacity: 0.6;
		animation: sectionPulse 3s ease-in-out infinite;
	}

	@keyframes sectionPulse {
		0%,
		100% {
			opacity: 0.6;
			transform: translateX(0%);
		}
		50% {
			opacity: 1;
			transform: translateX(10%);
		}
	}

	.section-card:hover {
		border-color: var(--section-color);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 40px var(--section-color);
		transform: translateY(-2px);
	}

	/* ===== SECTION HEADER ===== */
	.section-header {
		padding: 24px 24px 0 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-type-badge {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		align-self: flex-start;
		padding: 8px 16px;
		background: rgba(0, 0, 0, 0.5);
		border: 2px solid var(--section-color);
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 12px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--section-color);
		box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
	}

	.section-icon {
		font-size: 16px;
		line-height: 1;
	}

	.section-type-label {
		line-height: 1;
	}

	.section-name {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 22px;
		font-weight: 800;
		letter-spacing: -0.02em;
		text-transform: uppercase;
		color: #ffffff;
		margin: 0;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
	}

	/* ===== SECTION DIVIDER ===== */
	.section-divider {
		margin: 16px 24px;
		height: 2px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			var(--section-color) 20%,
			var(--section-color) 80%,
			transparent 100%
		);
		opacity: 0.3;
	}

	/* ===== SECTION CONTENT - MONOSPACED FOR AUTHENTICITY ===== */
	.section-content {
		padding: 0 24px 24px 24px;
	}

	.section-text {
		font-family: 'JetBrains Mono', 'Courier New', monospace;
		font-size: 15px;
		font-weight: 500;
		line-height: 1.8;
		color: #e5e5e5;
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		letter-spacing: 0.02em;
	}

	/* ===== SECTION FOOTER ===== */
	.section-footer {
		padding: 16px 24px 20px 24px;
		background: #0a0a0a;
		border-top: 2px solid var(--section-color);
		display: flex;
		justify-content: flex-end;
	}

	.btn-timer-active {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 20px;
		background: linear-gradient(135deg, #e91e8c 0%, #be185d 100%);
		border: 2px solid #e91e8c;
		color: #ffffff;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.2s ease;
		min-height: 44px;
	}

	.btn-timer-active:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(233, 30, 140, 0.4);
	}

	.timer-icon {
		flex-shrink: 0;
	}

	.timer-config-text {
		padding: 4px 8px;
		background: rgba(0, 0, 0, 0.3);
		font-size: 11px;
	}

	.no-timer-text {
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 12px;
		color: #525252;
	}

	/* ===== EMPTY SECTIONS STATE ===== */
	.empty-sections {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80px 20px;
		text-align: center;
		background: #1a1a1a;
		border: 2px dashed #2a2a2a;
	}

	.empty-icon {
		font-size: 64px;
		margin-bottom: 24px;
		opacity: 0.3;
		filter: grayscale(1);
	}

	.empty-text {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 600;
		color: #737373;
		margin: 0 0 24px 0;
	}

	.btn-edit-workout {
		padding: 14px 28px;
		background: linear-gradient(135deg, #6e489f 0%, #5c3a87 100%);
		border: 2px solid #6e489f;
		color: #ffffff;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 4px 12px rgba(110, 72, 159, 0.4);
		min-height: 48px;
	}

	.btn-edit-workout:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(110, 72, 159, 0.5);
	}

	/* ===== 404 NOT FOUND ===== */
	.not-found-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
	}

	.not-found-content {
		text-align: center;
		max-width: 500px;
	}

	.not-found-icon {
		font-size: 80px;
		margin-bottom: 32px;
		opacity: 0.4;
		filter: grayscale(1);
	}

	.not-found-title {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 32px;
		font-weight: 900;
		letter-spacing: -0.02em;
		text-transform: uppercase;
		color: #ffffff;
		margin: 0 0 16px 0;
	}

	.not-found-description {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 400;
		line-height: 1.6;
		color: #737373;
		margin: 0 0 40px 0;
	}

	.btn-back-to-library {
		display: inline-flex;
		align-items: center;
		gap: 12px;
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

	.btn-back-to-library:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(110, 72, 159, 0.5);
		border-color: #e91e8c;
	}

	.btn-icon-svg {
		flex-shrink: 0;
	}

	/* ===== LOADING SKELETONS ===== */
	.skeleton-sections {
		display: flex;
		flex-direction: column;
		gap: 24px;
		margin-top: 32px;
	}

	.section-skeleton {
		background: #1a1a1a;
		border: 3px solid #2a2a2a;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* ===== RESPONSIVE DESIGN ===== */
	@media (max-width: 640px) {
		.view-header {
			padding: 16px;
		}

		.back-text,
		.edit-text {
			display: none;
		}

		.btn-back,
		.btn-edit {
			padding: 12px;
		}

		.header-date {
			font-size: 14px;
		}

		.view-content {
			padding: 20px 16px;
		}

		.description-container {
			padding: 20px;
		}

		.description-text {
			font-size: 16px;
		}

		.section-header {
			padding: 20px 20px 0 20px;
		}

		.section-name {
			font-size: 18px;
		}

		.section-content {
			padding: 0 20px 20px 20px;
		}

		.section-text {
			font-size: 14px;
		}

		.section-footer {
			padding: 12px 20px 16px 20px;
		}

		.timer-text {
			display: none;
		}

		.not-found-title {
			font-size: 24px;
		}

		.not-found-icon {
			font-size: 64px;
		}
	}

	/* ===== ACCESSIBILITY ===== */
	@media (prefers-contrast: high) {
		.section-card {
			border-width: 4px;
		}

		.section-divider {
			opacity: 0.6;
		}
	}

	/* ===== REDUCED MOTION ===== */
	@media (prefers-reduced-motion: reduce) {
		.description-accent,
		.section-card::before {
			animation: none;
		}

		.btn-back:hover,
		.btn-edit:hover,
		.section-card:hover,
		.btn-edit-workout:hover,
		.btn-back-to-library:hover {
			transform: none;
		}

		.section-card,
		.btn-back,
		.btn-edit,
		.btn-edit-workout,
		.btn-back-to-library {
			transition: none;
		}
	}
</style>
