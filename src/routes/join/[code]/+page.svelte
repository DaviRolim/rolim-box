<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import AuthFrame from '$lib/components/shell/AuthFrame.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	let { data, form } = $props();

	let joining = $state(false);
	let joinError = $state('');
	let busy = $state(false);

	const roleName = $derived(data.invite?.role === 'coach' ? 'Coach' : 'Athlete');

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
				joinError = result.error ?? 'Could not join this box.';
			}
		} catch {
			joinError = 'Could not reach the server. Check your connection and try again.';
		} finally {
			joining = false;
		}
	}
</script>

<svelte:head>
	<title>{data.invite ? `Join ${data.invite.workspaceName}` : 'Invite'} - RolimBox</title>
</svelte:head>

<AuthFrame>
	{#if data.error === 'invalid'}
		<p class="legend text-danger-ink">Invite not found</p>
		<h1 class="mt-2 display text-[3.5rem]">Wrong code</h1>
		<p class="mt-3 text-lg leading-snug text-dim">
			This invite does not exist or was cancelled. Check the link, or ask your coach for a new one.
		</p>
		<a href={resolve('/login')} class="btn btn-ink mt-6 w-full">Go to log in</a>
	{:else if data.error === 'expired'}
		<p class="legend text-warn-ink">Invite expired</p>
		<h1 class="mt-2 display text-[3.5rem]">Too late</h1>
		<p class="mt-3 text-lg leading-snug text-dim">
			Invites last seven days and this one has run out. Ask your coach to send a fresh link.
		</p>
		<a href={resolve('/login')} class="btn btn-ink mt-6 w-full">Go to log in</a>
	{:else if data.invite}
		<p class="legend text-mute">You are invited to</p>
		<h1 class="mt-2 display text-[3.5rem] break-words">{data.invite.workspaceName}</h1>
		<div class="ticket mt-4">
			<span class="cell fill">{roleName}</span>
			<span class="cell legend">Invite {data.invite.code}</span>
		</div>

		{#if data.alreadyMember}
			<p class="mt-5 text-lg leading-snug text-dim">You are already part of this box.</p>
			<a href={resolve('/dashboard')} class="btn btn-pink btn-slab mt-5">See today's WoD</a>
		{:else if data.isLoggedIn}
			<p class="mt-5 text-lg leading-snug text-dim">
				{data.invite.role === 'coach'
					? 'As a coach you can program and edit the WoDs.'
					: "You will see the WoD every day, run the timers and keep your PRs on the box's board."}
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
				{joining ? 'Joining' : `Join ${data.invite.workspaceName}`}
			</button>
		{:else}
			<p class="mt-5 text-lg leading-snug text-dim">Create your account to get on the board.</p>
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
					{busy ? 'Creating' : 'Create account & join'}
				</button>
			</form>
			<p class="mt-8 border-t border-line-strong pt-5 text-base text-dim">
				Already have an account?
				<a href="{resolve('/login')}?redirect=/join/{data.invite.code}" class="link">Log in</a>
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
