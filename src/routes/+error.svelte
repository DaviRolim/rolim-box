<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="flex min-h-screen items-center justify-center bg-bg-base p-4">
	<div class="w-full max-w-md text-center">
		<div class="mb-6 text-6xl font-black text-accent-500">{page.status}</div>
		<h1 class="mb-2 text-2xl font-bold text-white">Something went wrong</h1>
		<p class="mb-8 text-text-muted">{page.error?.message ?? 'An unexpected error occurred.'}</p>
		<a
			href="/"
			class="inline-flex items-center gap-2 rounded-xl border border-transparent bg-accent-600 px-5 py-2.5 font-medium text-white transition-all hover:bg-accent-500"
		>
			Go Home
		</a>
	</div>
</div>
