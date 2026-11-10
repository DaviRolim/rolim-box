<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n';

	let { form } = $props();

	let busy = $state(false);
</script>

<svelte:head>
	<title>{t.common.pageTitle(t.auth.register.pageTitle)}</title>
</svelte:head>

<p class="legend text-mute">{t.auth.register.eyebrow}</p>
<h1 class="mt-2 display text-[3.5rem]">{t.auth.register.title}</h1>
<p class="mt-3 text-base leading-snug text-dim">{t.auth.register.intro}</p>

<form
	method="POST"
	class="mt-6 flex flex-col gap-4"
	use:enhance={() => {
		busy = true;
		return async ({ result, update }) => {
			if (result.type === 'redirect') {
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
			autocomplete="new-password"
			minlength="8"
			aria-describedby="password-help"
			required
		/>
		<p id="password-help" class="mt-1.5 text-base text-mute">{t.auth.passwordHelp}</p>
	</div>

	<button type="submit" class="btn btn-pink btn-slab mt-1" disabled={busy}>
		{busy ? t.auth.register.creating : t.auth.register.submit}
	</button>
</form>

<p class="mt-8 border-t border-line-strong pt-5 text-base text-dim">
	{t.auth.alreadyHaveAccount}
	<a href={resolve('/login')} class="link">{t.auth.logIn}</a>
</p>
