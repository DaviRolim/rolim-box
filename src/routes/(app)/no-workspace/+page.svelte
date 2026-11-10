<script lang="ts">
	import { resolve } from '$app/paths';
	import LogoutButton from '$lib/components/shell/LogoutButton.svelte';
	import { t } from '$lib/i18n';

	let { data } = $props();

	let inviteCode = $state('');

	function join(event: SubmitEvent) {
		event.preventDefault();
		const code = inviteCode.trim().toUpperCase();
		if (code) window.location.href = resolve('/join/[code]', { code });
	}
</script>

<svelte:head>
	<title>{t.common.pageTitle(t.auth.noBox.pageTitle)}</title>
</svelte:head>

<div class="px-4 py-8 lg:px-10 lg:py-12">
	<div class="max-w-2xl border-2 border-line-strong gridlines px-5 py-8 lg:p-12">
		<p class="inline-block -rotate-3 sign text-[3rem] text-pink-ink" lang="pt-BR">Cadê o box?</p>
		<h1 class="mt-4 display text-[3.5rem] lg:text-[5rem]">{t.auth.noBox.title}</h1>
		<p class="mt-3 max-w-md text-lg leading-snug text-dim">{t.auth.noBox.body(data.user.email)}</p>

		<form class="mt-6 max-w-md" onsubmit={join}>
			<label for="invite-code" class="field-label">{t.auth.noBox.inviteCode}</label>
			<div class="flex gap-2">
				<input
					id="invite-code"
					type="text"
					class="input flex-1 legend text-lg"
					placeholder="ABC-123"
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
					bind:value={inviteCode}
				/>
				<button type="submit" class="btn btn-pink" disabled={!inviteCode.trim()}
					>{t.auth.noBox.join}</button
				>
			</div>
		</form>

		<div class="mt-8 max-w-md border-t border-line-strong pt-5 lg:hidden">
			<LogoutButton class="btn btn-quiet w-full" />
		</div>
	</div>
</div>
