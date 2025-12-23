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

<!-- Empty state removed - Add Section button is self-explanatory -->
{#if sections.length > 0}
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
	.section-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* Mobile optimization */
	@media (max-width: 640px) {
		.section-list {
			gap: 12px;
		}
	}
</style>
