<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Card from '$lib/components/Card.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let unitPreference = $state(data.unitPreference);
	let isSaving = $state(false);

	async function handleUnitChange(newUnit: 'metric' | 'imperial') {
		if (newUnit === unitPreference) return;

		isSaving = true;
		try {
			const res = await fetch('/api/user/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ unitPreference: newUnit })
			});

			if (res.ok) {
				unitPreference = newUnit;
				await invalidateAll();
				toastStore.success('Settings saved');
			} else {
				toastStore.error('Failed to save settings');
			}
		} catch (error) {
			console.error('Failed to save settings:', error);
			toastStore.error('Failed to save settings');
		}
		isSaving = false;
	}
</script>

<div class="flex flex-col gap-6 p-4 pb-24 md:p-6">
	<!-- Header -->
	<header class="border-b border-white/10 pb-4">
		<h1
			class="bg-gradient-to-r from-white to-white/50 bg-clip-text text-3xl font-black tracking-tight text-transparent uppercase"
		>
			Settings
		</h1>
		<div class="h-1 w-16 bg-gradient-to-r from-accent-500 to-primary-500"></div>
	</header>

	<!-- Unit Preference -->
	<Card>
		<h2 class="mb-4 text-lg font-bold text-white">Units</h2>
		<p class="mb-4 text-sm text-text-muted">
			Choose your preferred measurement system for Personal Records.
		</p>

		<div class="flex gap-4">
			<button
				onclick={() => handleUnitChange('metric')}
				disabled={isSaving}
				class="flex-1 rounded-lg border-2 p-4 text-left transition-all {unitPreference === 'metric'
					? 'border-accent-500 bg-accent-500/10'
					: 'border-white/10 bg-white/5 hover:border-white/20'}"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-5 w-5 items-center justify-center rounded-full border-2 {unitPreference ===
						'metric'
							? 'border-accent-500'
							: 'border-white/30'}"
					>
						{#if unitPreference === 'metric'}
							<div class="h-2.5 w-2.5 rounded-full bg-accent-500"></div>
						{/if}
					</div>
					<div>
						<p class="font-bold text-white">Metric</p>
						<p class="text-xs text-text-muted">kg, meters</p>
					</div>
				</div>
			</button>

			<button
				onclick={() => handleUnitChange('imperial')}
				disabled={isSaving}
				class="flex-1 rounded-lg border-2 p-4 text-left transition-all {unitPreference ===
				'imperial'
					? 'border-accent-500 bg-accent-500/10'
					: 'border-white/10 bg-white/5 hover:border-white/20'}"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-5 w-5 items-center justify-center rounded-full border-2 {unitPreference ===
						'imperial'
							? 'border-accent-500'
							: 'border-white/30'}"
					>
						{#if unitPreference === 'imperial'}
							<div class="h-2.5 w-2.5 rounded-full bg-accent-500"></div>
						{/if}
					</div>
					<div>
						<p class="font-bold text-white">Imperial</p>
						<p class="text-xs text-text-muted">lbs, miles</p>
					</div>
				</div>
			</button>
		</div>
	</Card>

	<!-- Link to Workspace Settings -->
	<Card>
		<h2 class="mb-2 text-lg font-bold text-white">Workspace</h2>
		<p class="mb-4 text-sm text-text-muted">Manage workspace members and invitations.</p>
		<a
			href="/settings/workspace"
			class="inline-flex items-center gap-2 text-sm font-bold text-accent-400 hover:underline"
		>
			Workspace Settings
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</a>
	</Card>
</div>
