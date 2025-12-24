<!-- src/routes/(app)/timers/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { timerStore } from '$lib/stores/timer.svelte';
	import TimerConfigComponent from '$lib/components/timer/TimerConfig.svelte';
	import type { TimerConfig } from '$lib/types/timer';
	import type { PageData } from './$types';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';

	let { data }: { data: PageData } = $props();

	let configComponent: { getConfig: () => TimerConfig } | undefined = $state();

	function handleStart() {
		if (!configComponent) return;
		const config = configComponent.getConfig();
		timerStore.initialize(config);
		goto('/timers/standalone');
	}

	function handleBack() {
		goto('/dashboard');
	}
</script>

<svelte:head>
	<title>Timer - RolimBox</title>
</svelte:head>

<div class="flex flex-col gap-8 p-4 pb-24 md:p-6 lg:mx-auto lg:max-w-5xl">
	<!-- Header Section -->
	<header class="flex items-end justify-between border-b border-white/10 pb-4">
		<div>
			<h1
				class="bg-gradient-to-r from-white to-white/50 bg-clip-text text-3xl font-black tracking-tight text-transparent uppercase"
			>
				Timers
			</h1>
			<div class="h-1 w-16 bg-gradient-to-r from-accent-500 to-primary-500"></div>
		</div>
		<Button variant="ghost" size="sm" onclick={handleBack} class="text-accent-400">
			DASHBOARD
		</Button>
	</header>

	<main class="mx-auto grid w-full max-w-2xl grid-cols-1 gap-8">
		<Card class="overflow-hidden p-0">
			<div class="border-b border-white/5 bg-white/5 p-4 text-center">
				<h2 class="text-xs font-bold tracking-[0.2em] text-accent-400 uppercase">Configuration</h2>
			</div>

			<div class="p-6">
				<TimerConfigComponent bind:this={configComponent} initialType={data.timerType} />
			</div>
		</Card>

		<Button
			variant="primary"
			size="lg"
			onclick={handleStart}
			class="group relative overflow-hidden py-6 shadow-2xl shadow-accent-600/20"
		>
			<span class="relative z-10 flex items-center justify-center gap-3">
				<svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
					<path d="M8 5v14l11-7z" />
				</svg>
				START WORKOUT TIMER
			</span>
			<div
				class="absolute inset-0 bg-gradient-to-r from-accent-500 to-primary-500 opacity-0 transition-opacity group-hover:opacity-100"
			></div>
		</Button>
	</main>
</div>
