<script lang="ts">
	import { type Snippet } from 'svelte';

	let {
		children,
		title,
		class: className = '',
		...props
	} = $props<{
		children: Snippet;
		title?: string;
		class?: string;
		[key: string]: unknown;
	}>();
</script>

<div class="glass glass-hover relative overflow-hidden rounded-2xl p-5 {className}" {...props}>
	{#if title}
		<div class="mb-4">
			<h3 class="text-lg font-medium text-text-primary">{title}</h3>
		</div>
	{/if}

	{@render children()}
</div>
