<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/ui/Icon.svelte';

	let { form } = $props();

	let busy = $state(false);
</script>

<svelte:head>
	<title>Create an account - RolimBox</title>
</svelte:head>

<p class="legend text-mute">New to the box</p>
<h1 class="mt-2 display text-[3.5rem]">Create account</h1>
<p class="mt-3 text-base leading-snug text-dim">
	Joining an existing box? Ask a coach for an invite link instead: it puts you straight on their
	board.
</p>

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
			<p class="font-semibold">{form.error}</p>
		</div>
	{/if}

	<div>
		<label for="email" class="field-label">Email</label>
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
		<label for="password" class="field-label">Password</label>
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
		<p id="password-help" class="mt-1.5 text-base text-mute">At least 8 characters.</p>
	</div>

	<button type="submit" class="btn btn-pink btn-slab mt-1" disabled={busy}>
		{busy ? 'Creating' : 'Create account'}
	</button>
</form>

<p class="mt-8 border-t border-line-strong pt-5 text-base text-dim">
	Already have an account?
	<a href={resolve('/login')} class="link">Log in</a>
</p>
