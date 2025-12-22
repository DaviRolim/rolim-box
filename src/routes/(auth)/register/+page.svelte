<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { form } = $props();
</script>

<svelte:head>
	<title>Register - RolimBox</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-secondary-900 p-4">
	<div class="w-full max-w-md">
		<h1 class="mb-8 text-center text-3xl font-bold text-white">Create Account</h1>

		<form method="POST" use:enhance class="space-y-4">
			{#if form?.error}
				<div class="rounded bg-red-900/50 p-3 text-red-200">
					{form.error}
				</div>
			{/if}

			<div>
				<label for="email" class="mb-1 block text-sm text-gray-300">Email</label>
				<input
					type="email"
					id="email"
					name="email"
					required
					class="w-full rounded border border-gray-700 bg-secondary-800 px-4 py-2 text-white focus:border-accent-500 focus:outline-none"
				/>
			</div>

			<div>
				<label for="password" class="mb-1 block text-sm text-gray-300">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					minlength="8"
					class="w-full rounded border border-gray-700 bg-secondary-800 px-4 py-2 text-white focus:border-accent-500 focus:outline-none"
				/>
				<p class="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
			</div>

			<button
				type="submit"
				class="w-full rounded bg-accent-500 px-4 py-2 font-semibold text-white transition hover:bg-accent-400"
			>
				Register
			</button>
		</form>

		<p class="mt-4 text-center text-gray-400">
			Already have an account?
			<a href={resolve('/login')} class="text-accent-400 hover:underline">Log in</a>
		</p>
	</div>
</div>
