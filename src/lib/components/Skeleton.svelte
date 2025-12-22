<script lang="ts">
	type SkeletonVariant = 'text' | 'card' | 'circle' | 'button' | 'input';

	interface Props {
		variant?: SkeletonVariant;
		width?: string;
		height?: string;
		count?: number;
		class?: string;
	}

	let {
		variant = 'text',
		width = '100%',
		height,
		count = 1,
		class: className = ''
	}: Props = $props();

	const defaultHeights: Record<SkeletonVariant, string> = {
		text: '1em',
		card: '200px',
		circle: '48px',
		button: '48px',
		input: '44px'
	};

	const computedHeight = $derived(height || defaultHeights[variant]);
	const computedWidth = $derived(variant === 'circle' ? computedHeight : width);
	const borderRadius = $derived(
		variant === 'circle' ? '50%' : variant === 'button' || variant === 'input' ? '0' : '4px'
	);
</script>

{#if count > 1}
	<div class="skeleton-group {className}">
		{#each Array(count) as _, i}
			<div
				class="skeleton"
				data-variant={variant}
				style:width={computedWidth}
				style:height={computedHeight}
				style:border-radius={borderRadius}
				aria-hidden="true"
			></div>
		{/each}
	</div>
{:else}
	<div
		class="skeleton {className}"
		data-variant={variant}
		style:width={computedWidth}
		style:height={computedHeight}
		style:border-radius={borderRadius}
		aria-hidden="true"
	></div>
{/if}

<style>
	.skeleton-group {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.skeleton {
		background: linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 20%, #1a1a1a 40%, #1a1a1a 100%);
		background-size: 200% 100%;
		animation: shimmer 2s ease-in-out infinite;
		border: 1px solid #2a2a2a;
		position: relative;
		overflow: hidden;
		display: block;
	}

	/* Athletic brutalism - add geometric accent */
	.skeleton::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: linear-gradient(90deg, transparent 0%, #6e489f 50%, transparent 100%);
		background-size: 200% 100%;
		animation: accentSweep 3s ease-in-out infinite;
		opacity: 0.4;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	@keyframes accentSweep {
		0%,
		100% {
			background-position: 200% 0;
			opacity: 0.4;
		}
		50% {
			background-position: -200% 0;
			opacity: 0.7;
		}
	}

	/* Variant-specific adjustments */
	.skeleton[data-variant='text'] {
		max-width: 100%;
	}

	.skeleton[data-variant='card'] {
		min-height: 120px;
	}

	.skeleton[data-variant='button'] {
		min-width: 100px;
		border-width: 2px;
	}

	.skeleton[data-variant='input'] {
		border-width: 2px;
	}

	.skeleton[data-variant='circle']::after {
		display: none;
	}

	/* High contrast mode */
	@media (prefers-contrast: high) {
		.skeleton {
			background: #2a2a2a;
			border-color: #3a3a3a;
		}

		.skeleton::after {
			display: none;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.skeleton,
		.skeleton::after {
			animation: none;
		}

		.skeleton {
			background: #1a1a1a;
		}
	}

	/* Text-specific styles for natural text flow */
	.skeleton-group > .skeleton[data-variant='text']:nth-child(even) {
		width: 85%;
	}

	.skeleton-group > .skeleton[data-variant='text']:last-child {
		width: 65%;
	}
</style>
