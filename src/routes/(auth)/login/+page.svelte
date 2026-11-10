<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n';

	let { form } = $props();

	let busy = $state(false);
	let inviteCode = $state('');

	// Coming from an invite link: keep the way back to it (and to nothing else).
	const inviteBack = $derived(
		page.url.searchParams.get('redirect')?.match(/^\/join\/([A-Za-z0-9-]{1,32})$/)?.[1] ?? null
	);
</script>

<svelte:head>
	<title>{t.common.pageTitle(t.auth.login.title)}</title>
</svelte:head>

<p class="legend text-mute">{t.auth.login.eyebrow}</p>
<h1 class="mt-2 display text-[3.5rem]">{t.auth.login.title}</h1>

<form
	method="POST"
	class="mt-6 flex flex-col gap-4"
	use:enhance={() => {
		busy = true;
		return async ({ result, update }) => {
			if (result.type === 'redirect') {
				// A full page load, so the app starts clean with the new session.
				window.location.href = result.location;
			} else {
				busy = false;
				await update({ reset: false });
			}
		};
	}}
>
	{#if form?.error}
		<div class="notice notice-danger" role="alert">
			<span class="mt-0.5 flex-none text-danger-ink"
				><Icon name="alert" size={20} stroke={2.6} /></span
			>
			<p class="font-semibold">{t.auth.errors[form.error] ?? form.error}</p>
		</div>
	{/if}

	<div>
		<label for="email" class="field-label">{t.auth.email}</label>
		<input
			id="email"
			name="email"
			type="email"
			class="input"
			autocomplete="email"
			inputmode="email"
			autocapitalize="none"
			spellcheck="false"
			required
		/>
	</div>

	<div>
		<label for="password" class="field-label">{t.auth.password}</label>
		<input
			id="password"
			name="password"
			type="password"
			class="input"
			autocomplete="current-password"
			required
		/>
	</div>

	<button type="submit" class="btn btn-pink btn-slab mt-1" disabled={busy}>
		{busy ? t.auth.login.opening : t.auth.logIn}
	</button>
</form>

<div class="mt-8 border-t border-line-strong pt-5">
	<p class="text-base text-dim">
		{t.auth.login.newHere}
		{#if inviteBack}
			<a href={resolve('/join/[code]', { code: inviteBack })} class="link"
				>{t.auth.login.backToInvite}</a
			>
		{:else}
			<a href={resolve('/register')} class="link">{t.auth.login.createAccount}</a>
		{/if}
	</p>

	{#if !inviteBack}
		<form
			class="mt-5"
			onsubmit={(event) => {
				event.preventDefault();
				const code = inviteCode.trim().toUpperCase();
				if (code) window.location.href = resolve('/join/[code]', { code });
			}}
		>
			<label for="invite-code" class="field-label">{t.auth.login.gotCode}</label>
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
				<button type="submit" class="btn" disabled={!inviteCode.trim()}>{t.auth.login.join}</button>
			</div>
		</form>
	{/if}
</div>
