<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import AuthFrame from '$lib/components/shell/AuthFrame.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n';

	let { data, form } = $props();

	let joining = $state(false);
	let joinError = $state('');
	let busy = $state(false);

	const roleName = $derived(t.common.roles[data.invite?.role === 'coach' ? 'coach' : 'member']);

	async function acceptInvite() {
		if (!data.invite) return;
		joining = true;
		joinError = '';
		try {
			const response = await fetch(`/api/invites/${data.invite.code}/accept`, { method: 'POST' });
			const result = await response.json().catch(() => ({}));
			if (response.ok) {
				// A full page load, so the app opens on the new box.
				window.location.href = resolve('/dashboard');
			} else {
				joinError = result.error ?? t.auth.join.joinFailed;
			}
		} catch {
			joinError = t.auth.join.unreachable;
		} finally {
			joining = false;
		}
	}
</script>

<svelte:head>
	<title
		>{t.common.pageTitle(
			data.invite ? t.auth.join.pageTitle(data.invite.workspaceName) : t.auth.join.pageTitleFallback
		)}</title
	>
</svelte:head>

<AuthFrame>
	{#if data.error === 'invalid'}
		<p class="legend text-danger-ink">{t.auth.join.notFoundEyebrow}</p>
		<h1 class="mt-2 display text-[3.5rem]">{t.auth.join.notFoundTitle}</h1>
		<p class="mt-3 text-lg leading-snug text-dim">{t.auth.join.notFoundBody}</p>
		<a href={resolve('/login')} class="btn btn-ink mt-6 w-full">{t.auth.join.goToLogin}</a>
	{:else if data.error === 'expired'}
		<p class="legend text-warn-ink">{t.auth.join.expiredEyebrow}</p>
		<h1 class="mt-2 display text-[3.5rem]">{t.auth.join.expiredTitle}</h1>
		<p class="mt-3 text-lg leading-snug text-dim">{t.auth.join.expiredBody}</p>
		<a href={resolve('/login')} class="btn btn-ink mt-6 w-full">{t.auth.join.goToLogin}</a>
	{:else if data.invite}
		<p class="legend text-mute">{t.auth.join.invitedTo}</p>
		<h1 class="mt-2 display text-[3.5rem] break-words">{data.invite.workspaceName}</h1>
		<div class="ticket mt-4">
			<span class="cell fill">{roleName}</span>
			<span class="cell legend">{t.auth.join.inviteCode(data.invite.code)}</span>
		</div>

		{#if data.alreadyMember}
			<p class="mt-5 text-lg leading-snug text-dim">{t.auth.join.alreadyMember}</p>
			<a href={resolve('/dashboard')} class="btn btn-pink btn-slab mt-5">{t.auth.join.seeToday}</a>
		{:else if data.isLoggedIn}
			<p class="mt-5 text-lg leading-snug text-dim">
				{data.invite.role === 'coach' ? t.auth.join.asCoach : t.auth.join.asAthlete}
			</p>
			{#if joinError}
				<div class="notice notice-danger mt-4" role="alert">
					<span class="mt-0.5 flex-none text-danger-ink"
						><Icon name="alert" size={20} stroke={2.6} /></span
					>
					<p class="font-semibold">{joinError}</p>
				</div>
			{/if}
			<button
				type="button"
				class="btn btn-pink btn-slab mt-5"
				disabled={joining}
				onclick={acceptInvite}
			>
				{joining ? t.auth.join.joining : t.auth.join.joinBox(data.invite.workspaceName)}
			</button>
		{:else}
			<p class="mt-5 text-lg leading-snug text-dim">{t.auth.join.createToJoin}</p>
			<form
				method="POST"
				class="mt-5 flex flex-col gap-4"
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
					{busy ? t.auth.join.creating : t.auth.join.createAndJoin}
				</button>
			</form>
			<p class="mt-8 border-t border-line-strong pt-5 text-base text-dim">
				{t.auth.alreadyHaveAccount}
				<a href="{resolve('/login')}?redirect=/join/{data.invite.code}" class="link"
					>{t.auth.logIn}</a
				>
			</p>
		{/if}
	{/if}
</AuthFrame>

<style>
	.ticket {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		border: 2px solid var(--c-ink);
	}
	.cell {
		display: flex;
		align-items: center;
		padding: 0.5rem 0.75rem 0.4rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cell.fill {
		background: var(--c-pink);
		color: var(--c-on-fill);
		border-right: 2px solid var(--c-ink);
		font-stretch: 62%;
		font-weight: 900;
		font-size: 1.75rem;
		line-height: 1;
		text-transform: uppercase;
	}
</style>
