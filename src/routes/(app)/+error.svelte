<script lang="ts">
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
</script>

<div class="flex min-h-[60vh] items-center justify-center p-4">
	<div class="w-full max-w-md text-center">
		<div class="mb-6 text-6xl font-black text-accent-500">{page.status}</div>
		<h1 class="mb-2 text-2xl font-bold text-white">
			{#if page.status === 404}
				Page not found
			{:else}
				Something went wrong
			{/if}
		</h1>
		<p class="mb-8 text-text-muted">{page.error?.message ?? 'An unexpected error occurred.'}</p>
		<div class="flex justify-center gap-3">
			<Button variant="secondary" onclick={() => history.back()}>Go Back</Button>
			<a
				href="/dashboard"
				class="inline-flex items-center gap-2 rounded-xl border border-transparent bg-accent-600 px-5 py-2.5 font-medium text-white transition-all hover:bg-accent-500"
			>
				Dashboard
			</a>
		</div>
	</div>
</div>
