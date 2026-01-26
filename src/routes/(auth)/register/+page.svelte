<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';

	let { form } = $props();
	let isLoading = $state(false);
</script>

<svelte:head>
	<title>Register - RolimBox</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-bg-base p-4">
	<div class="w-full max-w-md">
		<h1 class="mb-8 text-center text-3xl font-bold text-white">Create Account</h1>

		<form
			method="POST"
			use:enhance={() => {
				isLoading = true;
				return async ({ result, update }) => {
					isLoading = false;
					if (result.type === 'redirect') {
						// Invalidate all cached data before redirect to ensure fresh auth state
						await invalidateAll();
						// Force a hard navigation to clear any stale state
						window.location.href = result.location;
					} else {
						await update();
					}
				};
			}}
			class="space-y-4"
		>
			{#if form?.error}
				<div class="rounded bg-red-900/50 p-3 text-red-200">
					{form.error}
				</div>
			{/if}

			<div>
				<label for="email" class="mb-1 block text-sm text-text-secondary">Email</label>
				<input
					type="email"
					id="email"
					name="email"
					required
					class="w-full rounded border border-gray-700 bg-bg-surface px-4 py-2 text-white focus:border-accent-500 focus:outline-none"
				/>
			</div>

			<div>
				<label for="password" class="mb-1 block text-sm text-text-secondary">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					minlength="8"
					class="w-full rounded border border-gray-700 bg-bg-surface px-4 py-2 text-white focus:border-accent-500 focus:outline-none"
				/>
				<p class="mt-1 text-xs text-text-muted">Minimum 8 characters</p>
			</div>

			<button
				type="submit"
				disabled={isLoading}
				class="w-full rounded bg-accent-500 px-4 py-2 font-semibold text-white transition hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isLoading ? 'Creating account...' : 'Register'}
			</button>
		</form>

		<p class="mt-4 text-center text-gray-400">
			Already have an account?
			<a href={resolve('/login')} class="text-accent-400 hover:underline">Log in</a>
		</p>
	</div>
</div>
