<!-- src/lib/components/timer/CountdownOverlay.svelte -->
<script lang="ts">
	interface Props {
		value: number | 'GO' | null;
	}

	let { value }: Props = $props();
</script>

{#if value !== null}
	<div class="countdown-overlay">
		<div class="countdown-value" class:go={value === 'GO'}>
			{value}
		</div>
	</div>
{/if}

<style>
	.countdown-overlay {
		position: fixed;
		inset: 0;
		background: #0a0a0a;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.countdown-value {
		font-family: 'Impact', 'Oswald', 'Arial Narrow', sans-serif;
		font-size: clamp(120px, 30vw, 200px);
		font-weight: 900;
		color: #ffffff;
		text-transform: uppercase;
		animation: pulse 0.5s ease-out;
	}

	.countdown-value.go {
		color: #e91e8c;
		animation: goPulse 0.5s ease-out;
	}

	@keyframes pulse {
		0% {
			transform: scale(0.8);
			opacity: 0.5;
		}
		50% {
			transform: scale(1.1);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@keyframes goPulse {
		0% {
			transform: scale(0.5);
			opacity: 0;
		}
		50% {
			transform: scale(1.2);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.countdown-value {
			animation: none;
		}
	}
</style>
