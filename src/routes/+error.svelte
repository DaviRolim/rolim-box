<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const notFound = $derived(page.status === 404);
	const offline = $derived(typeof navigator !== 'undefined' && !navigator.onLine);
</script>

<svelte:head>
	<title>{notFound ? 'Not found' : 'Something broke'} - RolimBox</title>
</svelte:head>

<main class="flex min-h-dvh flex-col justify-end p-4 pb-10 lg:justify-center lg:p-16">
	<div class="max-w-2xl border-2 border-line-strong gridlines px-5 py-8 lg:p-12">
		<p class="display text-[7rem] leading-none text-pink-ink lg:text-[11rem]">{page.status}</p>
		{#if notFound}
			<p class="mt-2 inline-block -rotate-3 sign text-[2.75rem] text-ink" lang="pt-BR">
				Errou o caminho.
			</p>
			<h1 class="mt-4 display text-[2.75rem] lg:text-[4rem]">Nothing at this address</h1>
			<p class="mt-3 max-w-md text-lg leading-snug text-dim">
				The page may have moved, or the link was typed wrong.
			</p>
		{:else if offline}
			<h1 class="mt-3 display text-[2.75rem] lg:text-[4rem]">This part needs a connection</h1>
			<p class="mt-3 max-w-md text-lg leading-snug text-dim">
				You are offline. Today's WoD, the list and the timers still work.
			</p>
		{:else}
			<h1 class="mt-3 display text-[2.75rem] lg:text-[4rem]">Something broke</h1>
			<p class="mt-3 max-w-md text-lg leading-snug text-dim">
				{page.error?.message ?? 'An unexpected error.'} Nothing you saved was lost.
			</p>
		{/if}
		<div class="mt-6 flex flex-wrap gap-2">
			<a href={resolve('/dashboard')} class="btn btn-pink">Back to today</a>
			{#if !notFound}
				<button type="button" class="btn btn-quiet" onclick={() => location.reload()}
					>Try again</button
				>
			{/if}
		</div>
	</div>
</main>
