<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { timerStore } from '$lib/stores/timer.svelte';
	import { wodStore } from '$lib/stores/wods.svelte';
	import { parseTimerConfig } from '$lib/types/timer';
	import Clock from '$lib/components/clock/Clock.svelte';

	const STANDALONE = 'rolimbox:standalone-timer';
	const AUTOSTART = 'rolimbox:standalone-autostart';

	const id = $derived(page.params.id ?? '');
	const wodId = $derived(page.url.searchParams.get('wod'));

	let problem = $state<{ title: string; detail: string } | null>(null);
	let ready = $state(false);
	let prepared: string | null = null;

	$effect(() => {
		const key = `${id}?${wodId ?? ''}`;
		if (prepared === key) return;

		if (id === 'standalone') {
			prepared = key;
			let saved = null;
			let autostart = false;
			try {
				saved = parseTimerConfig(sessionStorage.getItem(STANDALONE));
				// "Start timer" was tapped a moment ago: go straight into the countdown, once.
				autostart = sessionStorage.getItem(AUTOSTART) === '1';
				sessionStorage.removeItem(AUTOSTART);
			} catch {
				// storage blocked: fall through to whatever is in memory
			}

			if (autostart && timerStore.config && timerStore.state === 'idle') {
				ready = true;
				void timerStore.start();
			} else if (saved) {
				// Came back with the back button, or reloaded: same clock, but it waits for a tap.
				timerStore.initialize(saved);
				ready = true;
			} else if (timerStore.config && !timerStore.context) {
				ready = true;
			} else {
				void goto(resolve('/timers'), { replaceState: true });
			}
			return;
		}

		if (wodStore.loading) return; // the effect runs again when the list has arrived
		prepared = key;

		if (!wodId) {
			problem = {
				title: 'No WoD',
				detail: 'This clock link does not say which WoD it belongs to.'
			};
			return;
		}

		wodStore.find(wodId).then((wod) => {
			if (prepared !== key) return;
			if (wod === 'unavailable') {
				problem = {
					title: 'Not on this phone',
					detail: 'This WoD is not saved here and the server cannot be reached right now.'
				};
				return;
			}
			const section = wod?.sections.find((s) => s.id === id);
			const config = section ? parseTimerConfig(section.timerConfig) : null;
			if (!wod || !section) {
				problem = { title: 'Clock not found', detail: 'This part of the WoD no longer exists.' };
			} else if (!config) {
				problem = { title: 'No clock here', detail: `"${section.name}" has no clock set up.` };
			} else {
				timerStore.initialize(config, {
					sectionId: section.id,
					sectionName: section.name,
					wodId: wod.id,
					content: section.content,
					date: wod.date
				});
				ready = true;
			}
		});
	});

	function exit() {
		if (wodId) void goto(resolve('/(app)/workouts/[id]', { id: wodId }));
		else void goto(resolve('/timers'));
	}
</script>

<svelte:head>
	<title>Clock - RolimBox</title>
</svelte:head>

{#if ready}
	<Clock onexit={exit} />
{:else if problem}
	<div class="flex min-h-dvh flex-col justify-end p-4 pb-8 lg:justify-center lg:p-12">
		<p class="legend text-warn-ink">Clock</p>
		<h1 class="mt-3 display text-[4rem] lg:text-[6rem]">{problem.title}</h1>
		<p class="mt-3 max-w-md text-lg leading-snug text-dim">{problem.detail}</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<a href={resolve('/timers')} class="btn btn-ink">Set up a clock</a>
			<a href={resolve('/dashboard')} class="btn btn-quiet">Today</a>
		</div>
	</div>
{:else}
	<div
		class="flex min-h-dvh flex-col justify-center gap-3 p-4"
		aria-busy="true"
		aria-label="Loading the clock"
	>
		<div class="led h-40"></div>
		<div class="led h-40"></div>
		<div class="led mt-6 h-20"></div>
	</div>
{/if}
