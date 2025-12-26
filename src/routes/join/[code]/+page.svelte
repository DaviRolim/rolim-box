<script lang="ts">
	import { goto } from '$app/navigation';

	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleJoin() {
		if (data.isLoggedIn) {
			// Accept invite via API
			loading = true;
			error = '';
			try {
				const res = await fetch(`/api/invites/${data.invite?.code}/accept`, {
					method: 'POST'
				});
				const result = await res.json();
				if (res.ok) {
					// Store as active workspace and redirect
					localStorage.setItem('activeWorkspaceId', result.workspaceId);
					goto('/workouts');
				} else {
					error = result.error;
				}
			} catch {
				error = 'Failed to join workspace';
			} finally {
				loading = false;
			}
		}
	}

	async function handleRegister(event: Event) {
		event.preventDefault();
		loading = true;
		error = '';

		try {
			const formData = new FormData();
			formData.append('email', email);
			formData.append('password', password);
			formData.append('inviteCode', data.invite?.code || '');

			const res = await fetch('/join/' + data.invite?.code, {
				method: 'POST',
				body: formData
			});

			if (res.redirected) {
				window.location.href = res.url;
			} else {
				const result = await res.json();
				error = result.error || 'Registration failed';
			}
		} catch {
			error = 'Registration failed';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-bg-base px-4">
	<div class="w-full max-w-md">
		{#if data.error === 'invalid'}
			<div class="rounded-xl border border-error/20 bg-error/5 p-8 text-center">
				<h1 class="text-xl font-bold text-error">Invalid Invite</h1>
				<p class="mt-2 text-text-secondary">This invite code doesn't exist or has been revoked.</p>
				<a href="/login" class="mt-4 inline-block text-accent-400 hover:underline">Go to login</a>
			</div>
		{:else if data.error === 'expired'}
			<div class="rounded-xl border border-warning/20 bg-warning/5 p-8 text-center">
				<h1 class="text-xl font-bold text-warning">Invite Expired</h1>
				<p class="mt-2 text-text-secondary">This invite has expired. Ask for a new one.</p>
				<a href="/login" class="mt-4 inline-block text-accent-400 hover:underline">Go to login</a>
			</div>
		{:else if data.alreadyMember}
			<div class="rounded-xl border border-accent-500/20 bg-accent-500/5 p-8 text-center">
				<h1 class="text-xl font-bold text-accent-400">Already a Member</h1>
				<p class="mt-2 text-text-secondary">
					You're already a member of <strong>{data.invite?.workspaceName}</strong>.
				</p>
				<a href="/workouts" class="mt-4 inline-block rounded-lg bg-accent-500 px-4 py-2 font-bold text-white hover:bg-accent-600">
					Go to Workouts
				</a>
			</div>
		{:else if data.isLoggedIn}
			<!-- Logged in: show confirmation -->
			<div class="rounded-xl border border-white/10 bg-bg-surface p-8">
				<h1 class="text-center text-2xl font-bold text-white">Join Workspace</h1>
				<div class="mt-6 rounded-lg border border-white/5 bg-white/5 p-4 text-center">
					<p class="text-sm text-text-secondary">You've been invited to join</p>
					<p class="mt-1 text-xl font-bold text-white">{data.invite?.workspaceName}</p>
					<p class="mt-2 text-sm text-text-muted">
						as <span class="font-medium text-accent-400">{data.invite?.role}</span>
					</p>
				</div>

				{#if error}
					<p class="mt-4 text-center text-sm text-error">{error}</p>
				{/if}

				<button
					onclick={handleJoin}
					disabled={loading}
					class="mt-6 w-full rounded-lg bg-accent-500 py-3 font-bold text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
				>
					{loading ? 'Joining...' : 'Join Workspace'}
				</button>
			</div>
		{:else}
			<!-- Not logged in: show registration form -->
			<div class="rounded-xl border border-white/10 bg-bg-surface p-8">
				<h1 class="text-center text-2xl font-bold text-white">Join Workspace</h1>
				<div class="mt-4 rounded-lg border border-white/5 bg-white/5 p-4 text-center">
					<p class="text-sm text-text-secondary">You've been invited to join</p>
					<p class="mt-1 text-xl font-bold text-white">{data.invite?.workspaceName}</p>
					<p class="mt-2 text-sm text-text-muted">
						as <span class="font-medium text-accent-400">{data.invite?.role}</span>
					</p>
				</div>

				<form onsubmit={handleRegister} class="mt-6 space-y-4">
					<div>
						<label for="email" class="block text-sm font-medium text-text-secondary">Email</label>
						<input
							type="email"
							id="email"
							bind:value={email}
							required
							class="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-text-muted focus:border-accent-500 focus:outline-none"
							placeholder="you@example.com"
						/>
					</div>
					<div>
						<label for="password" class="block text-sm font-medium text-text-secondary">Password</label>
						<input
							type="password"
							id="password"
							bind:value={password}
							required
							minlength="8"
							class="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-text-muted focus:border-accent-500 focus:outline-none"
							placeholder="At least 8 characters"
						/>
					</div>

					{#if error}
						<p class="text-center text-sm text-error">{error}</p>
					{/if}

					<button
						type="submit"
						disabled={loading}
						class="w-full rounded-lg bg-accent-500 py-3 font-bold text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
					>
						{loading ? 'Creating account...' : 'Create Account & Join'}
					</button>
				</form>

				<p class="mt-4 text-center text-sm text-text-muted">
					Already have an account?
					<a href="/login?redirect=/join/{data.invite?.code}" class="text-accent-400 hover:underline">Log in</a>
				</p>
			</div>
		{/if}
	</div>
</div>
