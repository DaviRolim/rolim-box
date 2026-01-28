<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';

	let { form } = $props();
	let isLoading = $state(false);
</script>

<svelte:head>
	<title>Login - RolimBox</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-bg-base p-4">
	<div class="w-full max-w-md">
		<h1 class="mb-8 text-center text-3xl font-bold text-white">Welcome Back</h1>

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
					class="w-full rounded border border-gray-700 bg-bg-surface px-4 py-2 text-white focus:border-accent-500 focus:outline-none"
				/>
			</div>

			<button
				type="submit"
				disabled={isLoading}
				class="cyberpunk-btn w-full rounded bg-accent-500 px-4 py-2 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isLoading ? 'Logging in...' : 'Log In'}
			</button>
		</form>

		<p class="mt-4 text-center text-gray-400">
			Don't have an account?
			<a href={resolve('/register')} class="text-accent-400 hover:underline">Register</a>
		</p>
	</div>
</div>

<style>
	/* Cyberpunk electric hover effect - desktop only */
	@media (min-width: 768px) {
		.cyberpunk-btn {
			position: relative;
			overflow: hidden;
			transition: all 0.3s ease;
		}

		.cyberpunk-btn::before,
		.cyberpunk-btn::after {
			content: '';
			position: absolute;
			width: 0;
			height: 100%;
			top: 0;
			opacity: 0;
			transition: all 0.3s ease;
		}

		.cyberpunk-btn::before {
			left: 50%;
			background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.4), transparent);
			transform: translateX(-50%);
		}

		.cyberpunk-btn::after {
			right: 50%;
			background: linear-gradient(90deg, transparent, rgba(255, 0, 128, 0.4), transparent);
			transform: translateX(50%);
		}

		.cyberpunk-btn:hover:not(:disabled) {
			box-shadow:
				0 0 15px rgba(0, 255, 255, 0.5),
				0 0 30px rgba(255, 0, 128, 0.3),
				inset 0 0 15px rgba(0, 255, 255, 0.1);
			text-shadow:
				0 0 5px rgba(255, 255, 255, 0.8),
				0 0 10px rgba(0, 255, 255, 0.5);
			border: 1px solid rgba(0, 255, 255, 0.5);
		}

		.cyberpunk-btn:hover:not(:disabled)::before,
		.cyberpunk-btn:hover:not(:disabled)::after {
			width: 100%;
			opacity: 1;
			animation: electric-sweep 0.6s ease-in-out infinite alternate;
		}

		.cyberpunk-btn:hover:not(:disabled)::after {
			animation-delay: 0.3s;
		}

		@keyframes electric-sweep {
			0% {
				opacity: 0.3;
				filter: blur(2px);
			}
			100% {
				opacity: 0.7;
				filter: blur(4px);
			}
		}

		/* Electric border animation */
		.cyberpunk-btn:hover:not(:disabled) {
			animation: glitch-border 0.3s ease-in-out infinite alternate;
		}

		@keyframes glitch-border {
			0% {
				box-shadow:
					0 0 15px rgba(0, 255, 255, 0.5),
					0 0 30px rgba(255, 0, 128, 0.3),
					inset 0 0 15px rgba(0, 255, 255, 0.1);
			}
			100% {
				box-shadow:
					0 0 20px rgba(255, 0, 128, 0.5),
					0 0 35px rgba(0, 255, 255, 0.3),
					inset 0 0 20px rgba(255, 0, 128, 0.1);
			}
		}
	}

	/* Mobile: simple hover */
	@media (max-width: 767px) {
		.cyberpunk-btn:hover:not(:disabled) {
			filter: brightness(1.1);
		}
	}
</style>
