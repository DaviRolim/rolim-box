<script lang="ts">
	import { onMount } from 'svelte';
	import { listWoDs } from '$lib/services/wod';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import type { WoD } from '$lib/types/wod';

	let { data } = $props();

	let wods = $state<WoD[]>([]);
	let loading = $state(true);
	let todaysWoD = $state<WoD | null>(null);
	let recentWoDs = $state<WoD[]>([]);

	const today = new Date().toISOString().split('T')[0];

	onMount(async () => {
		if (!data.workspaceId) {
			loading = false;
			return;
		}

		try {
			wods = await listWoDs(data.workspaceId);

			// Find today's workout
			todaysWoD = wods.find((wod) => wod.date === today) || null;

			// Get recent workouts (last 3, excluding today's)
			recentWoDs = wods.filter((wod) => wod.date !== today).slice(0, 3);
		} catch (error) {
			console.error('Failed to load workouts:', error);
		} finally {
			loading = false;
		}
	});

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatDayOfWeek(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', { weekday: 'long' });
	}

	function getPreviewText(wod: WoD): string {
		if (wod.description) {
			return wod.description.slice(0, 100) + (wod.description.length > 100 ? '...' : '');
		}
		// Fallback to first section content
		if (wod.sections.length > 0) {
			const content = wod.sections[0].content;
			return content.slice(0, 100) + (content.length > 100 ? '...' : '');
		}
		return 'No description';
	}
</script>

<svelte:head>
	<title>Dashboard - RolimBox</title>
</svelte:head>

<div class="dashboard-container">
	<!-- Dashboard Header -->
	<div class="dashboard-header">
		<h1 class="dashboard-title">
			<span class="title-main">DASHBOARD</span>
			<span class="title-accent"></span>
		</h1>
		<div class="header-date">
			<span class="date-day">{formatDayOfWeek(today)}</span>
			<span class="date-full">{formatDate(today)}</span>
		</div>
	</div>

	<!-- Today's Workout Section -->
	<section class="section today-section">
		<div class="section-header">
			<h2 class="section-title">TODAY'S WORKOUT</h2>
			<div class="section-accent"></div>
		</div>

		{#if loading}
			<div class="today-card loading-card">
				<Skeleton variant="text" height="1.5rem" width="60%" />
				<Skeleton variant="text" height="1rem" width="100%" />
				<Skeleton variant="text" height="1rem" width="80%" />
				<div class="card-actions">
					<Skeleton variant="button" width="100px" height="44px" />
					<Skeleton variant="button" width="100px" height="44px" />
				</div>
			</div>
		{:else if todaysWoD}
			<div class="today-card">
				<div class="card-content">
					<div class="card-date">{formatDate(todaysWoD.date)}</div>
					<p class="card-description">{getPreviewText(todaysWoD)}</p>
					{#if todaysWoD.sections.length > 0}
						<div class="section-count">{todaysWoD.sections.length} sections</div>
					{/if}
				</div>
				<div class="card-actions">
					<a href="/workouts/{todaysWoD.id}" class="btn btn-primary">
						<span class="btn-text">VIEW</span>
					</a>
					<a href="/workouts/{todaysWoD.id}/edit" class="btn btn-secondary">
						<span class="btn-text">EDIT</span>
					</a>
				</div>
			</div>
		{:else}
			<div class="today-card empty-card">
				<div class="empty-icon">
					<div class="icon-bar"></div>
					<div class="icon-bar"></div>
					<div class="icon-bar"></div>
				</div>
				<p class="empty-text">No workout scheduled for today</p>
				<a href="/workouts/new" class="btn btn-primary">
					<span class="btn-text">CREATE TODAY'S WoD</span>
				</a>
			</div>
		{/if}
	</section>

	<!-- Quick Actions Section -->
	<section class="section quick-actions-section">
		<div class="section-header">
			<h2 class="section-title">QUICK ACTIONS</h2>
			<div class="section-accent"></div>
		</div>

		<div class="quick-actions-grid">
			<a href="/workouts/new" class="action-card action-new">
				<div class="action-icon">
					<div class="plus-icon">
						<div class="plus-h"></div>
						<div class="plus-v"></div>
					</div>
				</div>
				<span class="action-label">NEW WoD</span>
			</a>

			<a href="/workouts" class="action-card action-library">
				<div class="action-icon">
					<div class="library-icon">
						<div class="lib-line"></div>
						<div class="lib-line"></div>
						<div class="lib-line"></div>
					</div>
				</div>
				<span class="action-label">ALL WORKOUTS</span>
			</a>
		</div>
	</section>

	<!-- Timer Quick Actions -->
	<section class="section timer-section">
		<div class="section-header">
			<h2 class="section-title">QUICK TIMERS</h2>
			<div class="section-accent"></div>
		</div>

		<div class="timer-actions-grid">
			<a href="/timer?type=amrap" class="timer-card">
				<span class="timer-name">AMRAP</span>
				<span class="timer-desc">As Many Rounds As Possible</span>
			</a>
			<a href="/timer?type=emom" class="timer-card">
				<span class="timer-name">EMOM</span>
				<span class="timer-desc">Every Minute On the Minute</span>
			</a>
			<a href="/timer?type=fortime" class="timer-card">
				<span class="timer-name">FOR TIME</span>
				<span class="timer-desc">Complete for time</span>
			</a>
			<a href="/timer?type=tabata" class="timer-card">
				<span class="timer-name">TABATA</span>
				<span class="timer-desc">Work/Rest intervals</span>
			</a>
		</div>
	</section>

	<!-- Recent Workouts Section -->
	<section class="section recent-section">
		<div class="section-header">
			<h2 class="section-title">RECENT WORKOUTS</h2>
			<div class="section-accent"></div>
		</div>

		{#if loading}
			<div class="recent-list">
				{#each Array(3) as _, i}
					<div class="recent-item loading-item">
						<Skeleton variant="text" height="1rem" width="30%" />
						<Skeleton variant="text" height="1rem" width="100%" />
					</div>
				{/each}
			</div>
		{:else if recentWoDs.length > 0}
			<div class="recent-list">
				{#each recentWoDs as wod}
					<a href="/workouts/{wod.id}" class="recent-item">
						<div class="recent-date">
							<span class="date-marker"></span>
							<span>{formatDate(wod.date)}</span>
						</div>
						<div class="recent-preview">{getPreviewText(wod)}</div>
					</a>
				{/each}
			</div>
		{:else}
			<div class="recent-empty">
				<p>No recent workouts yet</p>
			</div>
		{/if}
	</section>
</div>

<style>
	/* ============================================================================
	   ATHLETIC BRUTALISM DASHBOARD DESIGN
	   Characteristics:
	   - Bold geometric shapes and hard edges
	   - High contrast with RolimBox brand colors (purple/pink)
	   - Raw, industrial aesthetic with athletic energy
	   - Prominent typography with condensed sans-serif
	   - Angular accents and strong grid structure
	   ============================================================================ */

	.dashboard-container {
		padding: clamp(1rem, 4vw, 2rem);
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: clamp(1.5rem, 4vw, 2.5rem);
	}

	/* ============================================================================
	   DASHBOARD HEADER
	   ============================================================================ */

	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		padding-bottom: 1rem;
		border-bottom: 3px solid #6e489f;
		position: relative;
	}

	.dashboard-title {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.title-main {
		font-family: 'Impact', 'Oswald', 'Arial Narrow', sans-serif;
		font-size: clamp(2rem, 5vw, 3rem);
		font-weight: 900;
		line-height: 0.9;
		letter-spacing: 0.02em;
		color: #ffffff;
		text-transform: uppercase;
		position: relative;
	}

	.title-accent {
		width: 60px;
		height: 4px;
		background: linear-gradient(90deg, #e91e8c 0%, #6e489f 100%);
		display: block;
		transform: skewX(-10deg);
	}

	.header-date {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
		padding: 0.5rem 0.75rem;
		background: #1a1a1a;
		border: 2px solid #2a2a2a;
		border-right: 3px solid #6e489f;
		transform: skewX(-5deg);
	}

	.header-date > * {
		transform: skewX(5deg);
	}

	.date-day {
		font-family: 'Impact', 'Oswald', 'Arial Narrow', sans-serif;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: #6e489f;
		text-transform: uppercase;
	}

	.date-full {
		font-size: 0.875rem;
		font-weight: 600;
		color: #ffffff;
	}

	/* ============================================================================
	   SECTION STRUCTURE
	   ============================================================================ */

	.section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.section-title {
		font-family: 'Impact', 'Oswald', 'Arial Narrow', sans-serif;
		font-size: clamp(1.25rem, 3vw, 1.5rem);
		font-weight: 900;
		letter-spacing: 0.05em;
		color: #ffffff;
		text-transform: uppercase;
		line-height: 1;
	}

	.section-accent {
		width: 40px;
		height: 3px;
		background: #e91e8c;
		transform: skewX(-10deg);
	}

	/* ============================================================================
	   TODAY'S WORKOUT CARD
	   ============================================================================ */

	.today-card {
		background: #1a1a1a;
		border: 3px solid #2a2a2a;
		border-left: 5px solid #e91e8c;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		position: relative;
		transform: translateZ(0);
		transition:
			border-color 0.3s ease,
			transform 0.3s ease;
	}

	.today-card::before {
		content: '';
		position: absolute;
		top: -3px;
		right: -3px;
		width: 20px;
		height: 20px;
		background: #e91e8c;
		clip-path: polygon(100% 0, 0 0, 100% 100%);
	}

	.today-card:hover {
		border-color: #6e489f;
		transform: translateX(3px);
	}

	.card-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card-date {
		font-family: 'Impact', 'Oswald', 'Arial Narrow', sans-serif;
		font-size: 0.875rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: #e91e8c;
		text-transform: uppercase;
	}

	.card-description {
		font-size: 1rem;
		line-height: 1.6;
		color: #e0e0e0;
	}

	.section-count {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		color: #6e489f;
		text-transform: uppercase;
		padding: 0.25rem 0.5rem;
		background: rgba(110, 72, 159, 0.15);
		border-left: 2px solid #6e489f;
		width: fit-content;
	}

	.card-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	/* Empty State */
	.empty-card {
		align-items: center;
		text-align: center;
		padding: 3rem 1.5rem;
		border-style: dashed;
	}

	.empty-icon {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.icon-bar {
		width: 4px;
		height: 40px;
		background: #2a2a2a;
		animation: pulse 1.5s ease-in-out infinite;
	}

	.icon-bar:nth-child(1) {
		animation-delay: 0s;
	}

	.icon-bar:nth-child(2) {
		animation-delay: 0.2s;
		height: 50px;
	}

	.icon-bar:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.3;
		}
		50% {
			opacity: 1;
			background: #6e489f;
		}
	}

	.empty-text {
		font-size: 1rem;
		color: #666666;
		margin-bottom: 1.5rem;
	}

	/* ============================================================================
	   BUTTONS
	   ============================================================================ */

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem 1.5rem;
		font-family: 'Impact', 'Oswald', 'Arial Narrow', sans-serif;
		font-size: 0.875rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-decoration: none;
		border: 2px solid;
		background: transparent;
		cursor: pointer;
		transition: all 0.2s ease;
		position: relative;
		overflow: hidden;
		min-height: 44px;
		transform: skewX(-5deg);
	}

	.btn-text {
		transform: skewX(5deg);
	}

	.btn::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: currentColor;
		transition: left 0.3s ease;
		z-index: -1;
	}

	.btn:hover::before {
		left: 0;
	}

	.btn-primary {
		color: #e91e8c;
		border-color: #e91e8c;
	}

	.btn-primary:hover {
		color: #ffffff;
		border-color: #e91e8c;
		background: #e91e8c;
	}

	.btn-secondary {
		color: #6e489f;
		border-color: #6e489f;
	}

	.btn-secondary:hover {
		color: #ffffff;
		border-color: #6e489f;
		background: #6e489f;
	}

	/* ============================================================================
	   QUICK ACTIONS GRID
	   ============================================================================ */

	.quick-actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
	}

	.action-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 2rem 1rem;
		background: #1a1a1a;
		border: 3px solid #2a2a2a;
		text-decoration: none;
		transition: all 0.3s ease;
		position: relative;
		min-height: 140px;
	}

	.action-card::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		width: 0;
		height: 3px;
		background: currentColor;
		transition: width 0.3s ease;
	}

	.action-card:hover {
		transform: translateY(-3px);
		border-color: currentColor;
	}

	.action-card:hover::after {
		width: 100%;
	}

	.action-new {
		color: #e91e8c;
	}

	.action-library {
		color: #6e489f;
	}

	.action-icon {
		width: 48px;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid currentColor;
		position: relative;
	}

	.plus-icon {
		position: relative;
		width: 24px;
		height: 24px;
	}

	.plus-h,
	.plus-v {
		position: absolute;
		background: currentColor;
	}

	.plus-h {
		width: 100%;
		height: 3px;
		top: 50%;
		left: 0;
		transform: translateY(-50%);
	}

	.plus-v {
		width: 3px;
		height: 100%;
		left: 50%;
		top: 0;
		transform: translateX(-50%);
	}

	.library-icon {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.lib-line {
		width: 24px;
		height: 3px;
		background: currentColor;
	}

	.lib-line:nth-child(2) {
		width: 20px;
	}

	.action-label {
		font-family: 'Impact', 'Oswald', 'Arial Narrow', sans-serif;
		font-size: 0.875rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: #ffffff;
		text-transform: uppercase;
		text-align: center;
	}

	/* ============================================================================
	   RECENT WORKOUTS LIST
	   ============================================================================ */

	.recent-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.recent-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		background: #1a1a1a;
		border: 2px solid #2a2a2a;
		border-left: 3px solid #6e489f;
		text-decoration: none;
		transition: all 0.2s ease;
		position: relative;
	}

	.recent-item::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		width: 0;
		height: 100%;
		background: rgba(110, 72, 159, 0.1);
		transition: width 0.3s ease;
	}

	.recent-item:hover {
		border-left-width: 5px;
		padding-left: calc(1rem - 2px);
	}

	.recent-item:hover::before {
		width: 100%;
	}

	.recent-date {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #6e489f;
	}

	.date-marker {
		width: 8px;
		height: 8px;
		background: #e91e8c;
		transform: rotate(45deg);
	}

	.recent-preview {
		font-size: 0.875rem;
		line-height: 1.5;
		color: #cccccc;
	}

	.recent-empty {
		padding: 2rem;
		text-align: center;
		background: #1a1a1a;
		border: 2px dashed #2a2a2a;
		color: #666666;
	}

	/* ============================================================================
	   LOADING STATES
	   ============================================================================ */

	.loading-card {
		gap: 1rem;
	}

	.loading-item {
		gap: 0.5rem;
	}

	/* ============================================================================
	   RESPONSIVE DESIGN
	   ============================================================================ */

	@media (max-width: 640px) {
		.dashboard-header {
			flex-direction: column;
			align-items: stretch;
		}

		.header-date {
			align-items: flex-start;
		}

		.card-actions {
			flex-direction: column;
		}

		.btn {
			width: 100%;
		}

		.quick-actions-grid {
			grid-template-columns: 1fr;
		}
	}

	/* ============================================================================
	   ACCESSIBILITY & REDUCED MOTION
	   ============================================================================ */

	@media (prefers-reduced-motion: reduce) {
		* {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
		}
	}

	@media (prefers-contrast: high) {
		.today-card,
		.action-card,
		.recent-item {
			border-width: 3px;
		}
	}

	/* ============================================================================
	   TIMER QUICK ACTIONS
	   ============================================================================ */

	/* Timer Quick Actions */
	.timer-section {
		margin-top: 0.5rem;
	}

	.timer-actions-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
	}

	.timer-card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 16px;
		background: #1a1a1a;
		border: 2px solid #2a2a2a;
		border-left: 4px solid #e91e8c;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.timer-card:hover {
		border-color: #e91e8c;
		transform: translateX(4px);
		background: rgba(233, 30, 140, 0.05);
	}

	.timer-name {
		font-family: 'Impact', 'Oswald', 'Arial Narrow', sans-serif;
		font-size: 16px;
		font-weight: 900;
		letter-spacing: 0.05em;
		color: #ffffff;
	}

	.timer-desc {
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 11px;
		font-weight: 500;
		color: #737373;
	}

	@media (max-width: 400px) {
		.timer-actions-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
