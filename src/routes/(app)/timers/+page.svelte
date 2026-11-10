<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { todayIso } from '$lib/date';
	import { timerStore } from '$lib/stores/timer.svelte';
	import { wodStore } from '$lib/stores/wods.svelte';
	import {
		TIMER_DEFAULTS,
		TIMER_DESCRIPTIONS,
		TIMER_LABELS,
		TIMER_TYPES,
		getTotalDuration,
		type TimerConfig,
		type TimerType
	} from '$lib/types/timer';
	import { clock, formatStrip, sectionTimer, timerChip } from '$lib/wod-format';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Stepper from '$lib/components/ui/Stepper.svelte';
	import { t } from '$lib/i18n';

	const STANDALONE = 'rolimbox:standalone-timer';
	const AUTOSTART = 'rolimbox:standalone-autostart';

	const requested = page.url.searchParams.get('type');
	let type = $state<TimerType>(
		(TIMER_TYPES as readonly string[]).includes(requested ?? '')
			? (requested as TimerType)
			: 'amrap'
	);

	// Each format remembers its own numbers while you flip between them.
	let minutes = $state({ amrap: 20, fortime: 15 });
	let emom = $state({
		rounds: TIMER_DEFAULTS.emom.rounds!,
		every: TIMER_DEFAULTS.emom.intervalWork!
	});
	let tabata = $state({
		rounds: TIMER_DEFAULTS.tabata.rounds!,
		work: TIMER_DEFAULTS.tabata.intervalWork!,
		rest: TIMER_DEFAULTS.tabata.intervalRest!
	});

	const config = $derived.by<TimerConfig>(() => {
		switch (type) {
			case 'amrap':
				return { type, duration: minutes.amrap * 60 };
			case 'fortime':
				return { type, duration: minutes.fortime * 60 };
			case 'emom':
				return { type, rounds: emom.rounds, intervalWork: emom.every };
			case 'tabata':
				return {
					type,
					rounds: tabata.rounds,
					intervalWork: tabata.work,
					intervalRest: tabata.rest
				};
		}
	});
	const strip = $derived(formatStrip(config));

	// Today's WoD, one tap away.
	const todays = $derived(
		wodStore.onDate(todayIso()).flatMap((wod) =>
			wod.sections.flatMap((section) => {
				const timer = sectionTimer(section);
				return timer ? [{ section, timer }] : [];
			})
		)
	);

	function start() {
		timerStore.initialize(config);
		try {
			sessionStorage.setItem(STANDALONE, JSON.stringify(config));
			sessionStorage.setItem(AUTOSTART, '1');
		} catch {
			// the clock still starts; it just cannot survive a reload
		}
		void goto(resolve('/(app)/timers/[id]', { id: 'standalone' }));
	}

	function onKeys(event: KeyboardEvent) {
		const index = TIMER_TYPES.indexOf(type);
		let next = index;
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
			next = (index + 1) % TIMER_TYPES.length;
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
			next = (index + TIMER_TYPES.length - 1) % TIMER_TYPES.length;
		else return;
		event.preventDefault();
		type = TIMER_TYPES[next];
		document.getElementById(`clock-type-${type}`)?.focus();
	}
</script>

<svelte:head>
	<title>{t.common.pageTitle(t.timer.setup.title)}</title>
</svelte:head>

<div class="page">
	<header>
		<p class="legend text-mute">{t.timer.setup.kicker}</p>
		<h1 class="mt-2 display text-[4.5rem] lg:text-[6rem]">{t.timer.setup.title}</h1>
	</header>

	<div class="cols">
		<form
			class="min-w-0"
			onsubmit={(event) => {
				event.preventDefault();
				start();
			}}
		>
			<!-- svelte-ignore a11y_interactive_supports_focus -->
			<div class="keys" role="radiogroup" aria-label={t.timer.setup.format} onkeydown={onKeys}>
				{#each TIMER_TYPES as option (option)}
					<button
						type="button"
						id="clock-type-{option}"
						role="radio"
						aria-checked={type === option}
						tabindex={type === option ? 0 : -1}
						class="key"
						class:on={type === option}
						onclick={() => (type = option)}
					>
						<span class="display text-[2.25rem]">{TIMER_LABELS[option]}</span>
						<span class="mt-1.5 block legend normal-case opacity-80" style="letter-spacing: 0.02em">
							{TIMER_DESCRIPTIONS[option]}
						</span>
					</button>
				{/each}
			</div>

			<div class="mt-6 grid gap-5 sm:grid-cols-2">
				{#if type === 'amrap'}
					<Stepper
						id="duration"
						label={t.timer.setup.minutes}
						unit="min"
						min={1}
						max={60}
						bind:value={minutes.amrap}
					/>
				{:else if type === 'fortime'}
					<Stepper
						id="duration"
						label={t.timer.setup.timeCap}
						unit="min"
						min={1}
						max={60}
						bind:value={minutes.fortime}
					/>
				{:else if type === 'emom'}
					<Stepper
						id="rounds"
						label={t.timer.setup.rounds}
						min={1}
						max={50}
						bind:value={emom.rounds}
					/>
					<Stepper
						id="interval"
						label={t.timer.setup.every}
						unit="s"
						min={10}
						max={300}
						step={5}
						bind:value={emom.every}
					/>
				{:else}
					<Stepper
						id="tabata-rounds"
						label={t.timer.setup.rounds}
						min={1}
						max={20}
						bind:value={tabata.rounds}
					/>
					<Stepper
						id="work"
						label={t.timer.setup.work}
						unit="s"
						min={5}
						max={60}
						step={5}
						bind:value={tabata.work}
					/>
					<Stepper
						id="rest"
						label={t.timer.setup.rest}
						unit="s"
						min={5}
						max={60}
						step={5}
						bind:value={tabata.rest}
					/>
				{/if}
			</div>

			<div class="summary" aria-live="polite">
				<span class="cell fill">{strip[0]}</span>
				<span class="cell">{strip[1]}</span>
				<span class="cell total">
					<span class="block legend opacity-70">{t.timer.setup.total}</span>
					{clock(getTotalDuration(config))}
				</span>
			</div>

			<button
				type="submit"
				class="btn btn-pink btn-slab mt-4"
				style="min-height: 5.5rem; font-size: 2.25rem"
			>
				<Icon name="play" solid size={26} />
				{t.timer.setup.start}
			</button>
		</form>

		<aside class="min-w-0">
			<div class="module-head border-t-2 border-ink">
				<span>{t.timer.setup.fromToday}</span>
				<span>{todays.length}</span>
			</div>
			{#if todays.length > 0}
				<ul>
					{#each todays as item, index (item.section.id)}
						<li>
							<a
								href="{resolve('/(app)/timers/[id]', { id: item.section.id })}?wod={item.section
									.wodId}"
								class="quick"
							>
								<span class="w-6 legend text-mute">{String(index + 1).padStart(2, '0')}</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate display text-[1.75rem]">{item.section.name}</span>
									<span class="mt-1 block legend text-dim">{timerChip(item.timer)}</span>
								</span>
								<Icon name="play" solid size={20} />
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="border-t border-line py-4 text-base leading-snug text-mute">
					{wodStore.loading ? t.timer.setup.reading : t.timer.setup.noClocksToday}
				</p>
			{/if}
		</aside>
	</div>
</div>

<style>
	.page {
		padding: 1.5rem calc(1rem + var(--safe-right)) 0 calc(1rem + var(--safe-left));
		max-width: 76rem;
	}
	.cols {
		display: grid;
		gap: 2.5rem;
		margin-top: 1.25rem;
	}
	.keys {
		display: grid;
		grid-template-columns: 1fr 1fr;
		border: 2px solid var(--c-ink);
	}
	.key {
		min-height: 6rem;
		padding: 0.875rem 0.75rem 0.75rem;
		text-align: left;
		color: var(--c-ink);
		border-right: 2px solid var(--c-ink);
		border-bottom: 2px solid var(--c-ink);
	}
	.key:nth-child(2n) {
		border-right: 0;
	}
	.key:nth-child(n + 3) {
		border-bottom: 0;
	}
	.key.on {
		background: var(--c-pink);
		color: var(--c-on-fill);
	}
	.key:focus-visible {
		outline-offset: -5px;
		box-shadow: none;
	}
	@media (hover: hover) {
		.key:not(.on):hover {
			background: var(--c-panel);
		}
	}
	.summary {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		margin-top: 1.5rem;
		border: 2px solid var(--c-ink);
	}
	.cell {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 0.5rem 0.75rem 0.4rem;
		font-stretch: 62%;
		font-weight: 900;
		font-size: 1.75rem;
		line-height: 1;
		text-transform: uppercase;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cell.fill {
		background: var(--c-ink);
		color: var(--c-bg);
	}
	.cell.total {
		border-left: 2px solid var(--c-ink);
		text-align: right;
		align-items: flex-end;
	}
	.quick {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 4.5rem;
		padding: 0.625rem 0.75rem 0.5rem 0;
		border-top: 1px solid var(--c-line);
		color: var(--c-ink);
		text-decoration: none;
	}
	@media (hover: hover) {
		.quick:hover {
			background: var(--c-panel);
		}
	}
	@media (min-width: 1024px) {
		.page {
			padding: 2.25rem 2.5rem 0;
		}
		.cols {
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
			gap: 3rem;
			align-items: start;
		}
		.keys {
			grid-template-columns: repeat(4, 1fr);
		}
		.key,
		.key:nth-child(2n) {
			border-right: 2px solid var(--c-ink);
			border-bottom: 0;
		}
		.key:last-child {
			border-right: 0;
		}
	}
</style>
