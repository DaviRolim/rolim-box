<script lang="ts">
	import SectionCard from './SectionCard.svelte';
	import type { Section } from '$lib/types/wod';

	interface Props {
		sections: Section[];
		editable?: boolean;
		onReorder?: (fromIndex: number, toIndex: number) => void;
		onEdit?: (section: Section) => void;
		onDelete?: (section: Section) => void;
	}

	let { sections, editable = false, onReorder, onEdit, onDelete }: Props = $props();

	function handleMoveUp(index: number) {
		if (onReorder && index > 0) {
			onReorder(index, index - 1);
		}
	}

	function handleMoveDown(index: number) {
		if (onReorder && index < sections.length - 1) {
			onReorder(index, index + 1);
		}
	}

	function handleEdit(section: Section) {
		if (onEdit) {
			onEdit(section);
		}
	}

	function handleDelete(section: Section) {
		if (onDelete) {
			onDelete(section);
		}
	}
</script>

{#if sections.length === 0}
	<div class="empty-state">
		<div class="empty-icon">
			<svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor">
				<rect x="8" y="12" width="32" height="28" stroke-width="2" stroke-linecap="square" />
				<line x1="8" y1="20" x2="40" y2="20" stroke-width="2" stroke-linecap="square" />
				<circle cx="16" cy="16" r="1.5" fill="currentColor" />
				<circle cx="24" cy="16" r="1.5" fill="currentColor" />
				<circle cx="32" cy="16" r="1.5" fill="currentColor" />
			</svg>
		</div>
		<h3 class="empty-title">No sections yet</h3>
		<p class="empty-message">Add your first section to start building your workout.</p>
	</div>
{:else}
	<div class="section-list">
		{#each sections as section, index (section.id)}
			<SectionCard
				{section}
				{editable}
				canMoveUp={index > 0}
				canMoveDown={index < sections.length - 1}
				onMoveUp={() => handleMoveUp(index)}
				onMoveDown={() => handleMoveDown(index)}
				onEdit={() => handleEdit(section)}
				onDelete={() => handleDelete(section)}
			/>
		{/each}
	</div>
{/if}

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 64px 24px;
		background: #1a1a1a;
		border: 2px dashed #2a2a2a;
		text-align: center;
	}

	.empty-icon {
		width: 64px;
		height: 64px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #525252;
		margin-bottom: 20px;
	}

	.empty-title {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 20px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: -0.01em;
		color: #ffffff;
		margin: 0 0 12px 0;
	}

	.empty-message {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 400;
		line-height: 1.6;
		color: #737373;
		margin: 0;
		max-width: 320px;
	}

	.section-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* Mobile optimization */
	@media (max-width: 640px) {
		.empty-state {
			padding: 48px 20px;
		}

		.empty-icon {
			width: 56px;
			height: 56px;
		}

		.empty-title {
			font-size: 18px;
		}

		.empty-message {
			font-size: 13px;
		}

		.section-list {
			gap: 12px;
		}
	}
</style>
