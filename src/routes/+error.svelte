<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { t } from '$lib/i18n';

	const notFound = $derived(page.status === 404);
	const offline = $derived(typeof navigator !== 'undefined' && !navigator.onLine);
</script>

<svelte:head>
	<title>{t.common.pageTitle(notFound ? t.auth.error.notFound : t.auth.error.broke)}</title>
</svelte:head>

<main class="flex min-h-dvh flex-col justify-end p-4 pb-10 lg:justify-center lg:p-16">
	<div class="max-w-2xl border-2 border-line-strong gridlines px-5 py-8 lg:p-12">
		<p class="display text-[7rem] leading-none text-pink-ink lg:text-[11rem]">{page.status}</p>
		{#if notFound}
			<p class="mt-2 inline-block -rotate-3 sign text-[2.75rem] text-ink" lang="pt-BR">
				Errou o caminho.
			</p>
			<h1 class="mt-4 display text-[2.75rem] lg:text-[4rem]">{t.auth.error.nothingHere}</h1>
			<p class="mt-3 max-w-md text-lg leading-snug text-dim">{t.auth.error.moved}</p>
		{:else if offline}
			<h1 class="mt-3 display text-[2.75rem] lg:text-[4rem]">{t.auth.error.needsConnection}</h1>
			<p class="mt-3 max-w-md text-lg leading-snug text-dim">{t.auth.error.offlineBody}</p>
		{:else}
			<h1 class="mt-3 display text-[2.75rem] lg:text-[4rem]">{t.auth.error.broke}</h1>
			<p class="mt-3 max-w-md text-lg leading-snug text-dim">
				{page.error?.message ?? t.auth.error.unexpected}
				{t.auth.error.nothingLost}
			</p>
		{/if}
		<div class="mt-6 flex flex-wrap gap-2">
			<a href={resolve('/dashboard')} class="btn btn-pink">{t.auth.error.backToToday}</a>
			{#if !notFound}
				<button type="button" class="btn btn-quiet" onclick={() => location.reload()}
					>{t.auth.error.tryAgain}</button
				>
			{/if}
		</div>
	</div>
</main>
