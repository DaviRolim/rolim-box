<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getWoD } from '$lib/services/wod';
	import { toastStore } from '$lib/stores/toast.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import SectionList from '$lib/components/sections/SectionList.svelte';
	import type { PageData } from './$types';
	import type { WoD } from '$lib/types/wod';

	let { data }: { data: PageData } = $props();

	// State
	let wod = $state<WoD | null>(null);
	let isLoading = $state(true);
	let notFound = $state(false);

	onMount(async () => {
		try {
			const loadedWod = await getWoD(data.wodId);
			if (loadedWod) {
				wod = loadedWod;
			} else {
				notFound = true;
				toastStore.error('Workout not found');
			}
		} catch (error) {
			console.error('Failed to load workout:', error);
			toastStore.error('Failed to load workout');
			notFound = true;
		} finally {
			isLoading = false;
		}
	});

	// Format date in a human-readable way
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// Navigation handlers
	function handleBack() {
		goto('/workouts');
	}

	function handleEdit() {
		if (wod) {
			goto(`/workouts/${wod.id}/edit`);
		}
	}
</script>

<div class="flex flex-col gap-8 p-4 pb-24 md:p-6 lg:mx-auto lg:max-w-5xl">
	{#if isLoading}
		<!-- Loading State -->
		<div class="space-y-6">
			<div class="flex items-center justify-between">
				<div class="space-y-2">
					<Skeleton variant="text" width="100px" height="20px" />
					<Skeleton variant="text" width="200px" height="32px" />
				</div>
				<Skeleton variant="button" width="100px" height="40px" />
			</div>

			<Card class="space-y-4">
				<Skeleton variant="text" width="100%" height="24px" />
				<Skeleton variant="text" width="80%" height="24px" />
			</Card>

			<div class="space-y-4">
				{#each Array(2) as _}
					<div class="h-40 rounded-2xl border border-white/5 bg-white/5 p-6">
						<Skeleton variant="text" width="150px" height="24px" />
						<div class="mt-4 space-y-2">
							<Skeleton variant="text" width="100%" height="16px" />
							<Skeleton variant="text" width="100%" height="16px" />
							<Skeleton variant="text" width="60%" height="16px" />
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else if notFound || !wod}
		<!-- 404 State -->
		<div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
			<div
				class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-4xl text-text-muted"
			>
				🔍
			</div>
			<h1 class="mb-2 text-2xl font-black tracking-tight text-white uppercase">
				Workout Not Found
			</h1>
			<p class="mb-8 max-w-md text-text-secondary">
				The workout you're looking for doesn't exist or has been deleted.
			</p>
			<Button variant="primary" onclick={handleBack}>Back to Library</Button>
		</div>
	{:else}
		<!-- WoD View -->
		<header class="flex items-center justify-between border-b border-white/10 pb-4">
			<div class="flex items-center gap-4">
				<Button variant="ghost" size="sm" onclick={handleBack} class="p-2">
					<svg
						class="h-5 w-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</Button>
				<div>
					<div class="flex items-center gap-3">
						<span class="text-[10px] font-bold tracking-widest text-accent-400 uppercase">
							{formatDate(wod.date)}
						</span>
					</div>
					<h1 class="text-3xl font-black tracking-tight text-white uppercase">Workout Details</h1>
					<div class="h-1 w-12 bg-gradient-to-r from-accent-500 to-primary-500"></div>
				</div>
			</div>
			<Button variant="secondary" size="sm" onclick={handleEdit} class="gap-2">
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
				</svg>
				EDIT
			</Button>
		</header>

		<!-- Content -->
		<div class="space-y-8">
			<!-- Description Section -->
			{#if wod.description}
				<Card class="relative overflow-hidden border-l-4 border-l-accent-500">
					<h3 class="mb-2 text-xs font-bold tracking-widest text-text-muted uppercase">
						Description
					</h3>
					<p class="text-lg leading-relaxed font-medium text-white">
						{wod.description}
					</p>
				</Card>
			{/if}

			<!-- Sections -->
			<div class="space-y-6">
				<div class="flex items-center justify-between">
					<h2 class="text-xl font-black tracking-tight text-white uppercase">Workout Structure</h2>
					<span
						class="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold tracking-widest text-text-muted uppercase"
					>
						{wod.sections.length} Sections
					</span>
				</div>

				<SectionList sections={wod.sections} editable={false} />

				<!-- Empty sections state -->
				{#if wod.sections.length === 0}
					<div
						class="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-white/5 p-12 text-center"
					>
						<div class="text-4xl opacity-50">📝</div>
						<p class="text-sm font-medium text-text-secondary">No sections in this workout.</p>
						<Button variant="primary" size="sm" onclick={handleEdit}>Add Sections</Button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
