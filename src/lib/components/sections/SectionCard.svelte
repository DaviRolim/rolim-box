<script lang="ts">
	import { sectionTypes } from '$lib/config/section-types';
	import type { Section } from '$lib/types/wod';
	import { parseTimerConfig, TIMER_LABELS, formatTime } from '$lib/types/timer';

	interface Props {
		section: Section;
		editable?: boolean;
		canMoveUp?: boolean;
		canMoveDown?: boolean;
		onMoveUp?: () => void;
		onMoveDown?: () => void;
		onEdit?: () => void;
		onDelete?: () => void;
		expanded?: boolean;
	}

	let {
		section,
		editable = false,
		canMoveUp = false,
		canMoveDown = false,
		onMoveUp,
		onMoveDown,
		onEdit,
		onDelete,
		expanded = false
	}: Props = $props();

	const sectionConfig = $derived(sectionTypes[section.type]);
	const truncatedContent = $derived(
		section.content.length > 100 && !expanded
			? section.content.slice(0, 100) + '...'
			: section.content
	);
	const timerConfig = $derived(parseTimerConfig(section.timerConfig));
</script>

<div class="section-card" data-color={sectionConfig.color}>
	<!-- Kinetic accent line -->
	<div class="section-accent" data-color={sectionConfig.color}></div>

	<div class="section-header">
		<div class="section-badge" data-color={sectionConfig.color}>
			<span class="section-icon" role="img" aria-label={sectionConfig.label}>
				{sectionConfig.icon}
			</span>
			<span class="section-type">{sectionConfig.label}</span>
		</div>

		{#if editable}
			<div class="section-controls">
				<div class="reorder-buttons">
					<button
						type="button"
						class="btn-reorder"
						onclick={onMoveUp}
						disabled={!canMoveUp}
						aria-label="Move section up"
						title="Move up"
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
							<path d="M8 12V4M8 4L4 8M8 4L12 8" stroke-width="2" stroke-linecap="square" />
						</svg>
					</button>
					<button
						type="button"
						class="btn-reorder"
						onclick={onMoveDown}
						disabled={!canMoveDown}
						aria-label="Move section down"
						title="Move down"
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
							<path d="M8 4V12M8 12L4 8M8 12L12 8" stroke-width="2" stroke-linecap="square" />
						</svg>
					</button>
				</div>

				<button
					type="button"
					class="btn-edit"
					onclick={onEdit}
					aria-label="Edit section"
					title="Edit"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
						<path
							d="M11.5 2L14 4.5L5 13.5H2.5V11L11.5 2Z"
							stroke-width="1.5"
							stroke-linecap="square"
						/>
					</svg>
					Edit
				</button>

				<button
					type="button"
					class="btn-delete"
					onclick={onDelete}
					aria-label="Delete section"
					title="Delete"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
						<path d="M3 4H13M5 4V3H11V4M6 7V11M10 7V11" stroke-width="1.5" stroke-linecap="square" />
						<path d="M4 4H12V13H4V4Z" stroke-width="1.5" stroke-linecap="square" />
					</svg>
				</button>
			</div>
		{/if}
	</div>

	<div class="section-body">
		<h3 class="section-name">{section.name}</h3>
		<pre class="section-content">{truncatedContent}</pre>
	</div>

	<div class="section-footer">
		{#if timerConfig}
			<a
				href="/timer/{section.id}?wod={section.wodId}"
				class="btn-timer-active"
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
					<circle cx="8" cy="8" r="6" stroke-width="1.5" />
					<path d="M8 5V8L10.5 10.5" stroke-width="1.5" stroke-linecap="square" />
				</svg>
				{TIMER_LABELS[timerConfig.type]}
				{#if timerConfig.type === 'amrap' || timerConfig.type === 'fortime'}
					- {formatTime(timerConfig.duration!)}
				{:else if timerConfig.type === 'emom'}
					- {timerConfig.rounds}x{timerConfig.intervalWork}s
				{:else if timerConfig.type === 'tabata'}
					- {timerConfig.rounds}x {timerConfig.intervalWork}s/{timerConfig.intervalRest}s
				{/if}
			</a>
		{:else}
			<button type="button" class="btn-timer" disabled title="No timer configured">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
					<circle cx="8" cy="8" r="6" stroke-width="1.5" />
					<path d="M8 5V8L10.5 10.5" stroke-width="1.5" stroke-linecap="square" />
				</svg>
				No Timer
			</button>
		{/if}
	</div>
</div>

<style>
	.section-card {
		background: var(--color-secondary-800);
		border: 2px solid var(--color-secondary-700);
		position: relative;
		overflow: hidden;
		transition: border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.section-card:hover {
		border-color: #3a3a3a;
	}

	/* Kinetic accent - bold geometric bar */
	.section-accent {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		animation: accentPulse 2s ease-in-out infinite;
	}

	.section-accent[data-color='orange'] {
		background: linear-gradient(90deg, var(--color-section-warmup) 0%, #ea580c 100%);
	}

	.section-accent[data-color='blue'] {
		background: linear-gradient(90deg, var(--color-section-skill) 0%, #2563eb 100%);
	}

	.section-accent[data-color='pink'] {
		background: linear-gradient(90deg, var(--color-section-wod) 0%, #be185d 100%);
	}

	.section-accent[data-color='cyan'] {
		background: linear-gradient(90deg, var(--color-section-cooldown) 0%, #0891b2 100%);
	}

	.section-accent[data-color='purple'] {
		background: linear-gradient(90deg, #6e489f 0%, #5c3a87 100%);
	}

	.section-accent[data-color='gray'] {
		background: linear-gradient(90deg, #737373 0%, #525252 100%);
	}

	@keyframes accentPulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	.section-header {
		padding: 20px 20px 16px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}

	.section-badge {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 16px;
		border: 2px solid;
		background: rgba(0, 0, 0, 0.3);
	}

	.section-badge[data-color='orange'] {
		border-color: var(--color-section-warmup);
		color: var(--color-section-warmup);
	}

	.section-badge[data-color='blue'] {
		border-color: var(--color-section-skill);
		color: var(--color-section-skill);
	}

	.section-badge[data-color='pink'] {
		border-color: var(--color-section-wod);
		color: var(--color-section-wod);
	}

	.section-badge[data-color='cyan'] {
		border-color: var(--color-section-cooldown);
		color: var(--color-section-cooldown);
	}

	.section-badge[data-color='purple'] {
		border-color: #6e489f;
		color: #6e489f;
	}

	.section-badge[data-color='gray'] {
		border-color: #737373;
		color: #737373;
	}

	.section-icon {
		font-size: 18px;
		line-height: 1;
	}

	.section-type {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 12px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.section-controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.reorder-buttons {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.btn-reorder {
		width: 44px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid var(--color-secondary-700);
		color: #737373;
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		padding: 0;
	}

	.btn-reorder:not(:disabled):hover {
		background: var(--color-secondary-700);
		border-color: #3a3a3a;
		color: #ffffff;
		transform: translateY(-1px);
	}

	.btn-reorder:not(:disabled):active {
		transform: translateY(0);
	}

	.btn-reorder:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.btn-reorder:focus-visible {
		outline: 2px solid #6e489f;
		outline-offset: 2px;
	}

	.btn-edit,
	.btn-delete {
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0 16px;
		border: 2px solid;
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		background: transparent;
	}

	.btn-edit {
		border-color: #6e489f;
		color: #6e489f;
	}

	.btn-edit:hover {
		background: rgba(110, 72, 159, 0.15);
		border-color: #8b5fc9;
		transform: translateY(-1px);
	}

	.btn-delete {
		border-color: var(--color-error);
		color: var(--color-error);
		padding: 0 12px;
	}

	.btn-delete:hover {
		background: rgba(239, 68, 68, 0.15);
		border-color: #f87171;
		transform: translateY(-1px);
	}

	.btn-edit:active,
	.btn-delete:active {
		transform: translateY(0);
	}

	.btn-edit:focus-visible,
	.btn-delete:focus-visible {
		outline: 2px solid #6e489f;
		outline-offset: 2px;
	}

	.section-body {
		padding: 0 20px 20px 20px;
	}

	.section-name {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 18px;
		font-weight: 700;
		color: #ffffff;
		margin: 0 0 12px 0;
	}

	.section-content {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 400;
		line-height: 1.7;
		color: #a3a3a3;
		margin: 0;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.section-footer {
		padding: 16px 20px;
		background: var(--color-secondary-900);
		border-top: 1px solid var(--color-secondary-700);
	}

	.btn-timer {
		width: 100%;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0 20px;
		border: 2px solid var(--color-secondary-700);
		background: transparent;
		color: #525252;
		cursor: not-allowed;
		opacity: 0.5;
	}

	.btn-timer-active {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 20px;
		background: linear-gradient(135deg, var(--color-section-wod) 0%, #be185d 100%);
		border: 2px solid var(--color-section-wod);
		color: #ffffff;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.2s ease;
		min-height: 48px;
	}

	.btn-timer-active:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(233, 30, 140, 0.4);
	}

	/* Mobile optimization */
	@media (max-width: 640px) {
		.section-header {
			padding: 16px 16px 12px 16px;
		}

		.section-controls {
			width: 100%;
			justify-content: flex-end;
		}

		.btn-edit {
			flex: 1;
		}

		.section-body {
			padding: 0 16px 16px 16px;
		}

		.section-name {
			font-size: 16px;
		}

		.section-content {
			font-size: 13px;
		}

		.section-footer {
			padding: 12px 16px;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.section-card,
		.section-accent,
		.btn-reorder,
		.btn-edit,
		.btn-delete {
			animation: none;
			transition: none;
		}

		.btn-reorder:not(:disabled):hover,
		.btn-edit:hover,
		.btn-delete:hover {
			transform: none;
		}
	}
</style>
