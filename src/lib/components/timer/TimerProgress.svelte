<!-- src/lib/components/timer/TimerProgress.svelte -->
<script lang="ts">
	interface Props {
		progress: number; // 0-1
	}

	let { progress }: Props = $props();
</script>

<div class="progress-container">
	<div class="progress-track">
		<div class="progress-fill" style="width: {progress * 100}%"></div>
	</div>
</div>

<style>
	.progress-container {
		width: 100%;
		padding: 0 24px;
	}

	.progress-track {
		width: 100%;
		height: 6px;
		background: #2a2a2a;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #6e489f 0%, #e91e8c 100%);
		transition: width 0.1s linear;
	}
</style>
