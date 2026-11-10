<script lang="ts">
	import { onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { fitBox, fitText } from '$lib/actions/fit';
	import { formatShort, todayIso } from '$lib/date';
	import { audioService } from '$lib/services/audio.svelte';
	import { timerStore } from '$lib/stores/timer.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { TIMER_LABELS, formatTimeMs } from '$lib/types/timer';
	import { emomSlot, formatStrip } from '$lib/wod-format';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Board from '$lib/components/wod/Board.svelte';
	import { t } from '$lib/i18n';

	/**
	 * The tower clock. It owns the whole screen: minutes stacked over seconds as tall as the
	 * phone, the ground flooding pink whenever it is time to move, one slab for the one action
	 * that matters in each state, and a finish line at the end.
	 */
	interface Props {
		onexit: () => void;
	}

	let { onexit }: Props = $props();

	const BOARD_PREF = 'rolimbox:clock-board';

	let root = $state<HTMLElement>();
	let exitOpen = $state(false);
	let flash = $state(false);
	let isFullscreen = $state(false);
	let boardPref = $state<boolean>(readBoardPref());

	function readBoardPref(): boolean {
		if (!browser) return false;
		let saved: string | null = null;
		try {
			saved = localStorage.getItem(BOARD_PREF);
		} catch {
			// storage blocked: use the default for this screen size
		}
		return (saved ?? (window.innerWidth >= 1024 ? '1' : '0')) === '1';
	}

	const config = $derived(timerStore.config);
	const phase = $derived(timerStore.state);
	const type = $derived(config?.type ?? 'amrap');
	const context = $derived(timerStore.context);
	const name = $derived(context?.sectionName?.trim() || TIMER_LABELS[type]);
	const strip = $derived(config ? formatStrip(config) : (['', ''] as [string, string]));
	const content = $derived(context?.content?.trim() ?? '');
	const intervals = $derived(type === 'emom' || type === 'tabata');
	const counting = $derived(type === 'amrap' || type === 'fortime');

	const time = $derived(timerStore.displayTime.split(':'));
	const remainingTotalMs = $derived(timerStore.totalMs - timerStore.elapsedMs);
	const urgent = $derived(
		phase === 'running' && (intervals ? timerStore.remainingMs <= 3000 : remainingTotalMs <= 10_000)
	);
	const second = $derived(Math.ceil(timerStore.remainingMs / 1000));

	const working = $derived(type === 'tabata' && timerStore.isWorkPhase);
	// Pink means move.
	const flood = $derived(
		phase === 'completed' ||
			timerStore.countdownValue === 'GO' ||
			(phase === 'running' && (working || flash))
	);

	const slot = $derived(
		type === 'emom' && content ? emomSlot(content, timerStore.currentRound) : null
	);
	const boardVisible = $derived(
		content !== '' &&
			(phase === 'idle' || (boardPref && (phase === 'running' || phase === 'paused')))
	);

	// A new EMOM round hits the whole screen for a moment, so nobody has to read to notice it.
	let lastRound = 1;
	$effect(() => {
		const round = timerStore.currentRound;
		if (type === 'emom' && phase === 'running' && round !== lastRound && round > 1) {
			flash = true;
			const timeout = setTimeout(() => (flash = false), 900);
			lastRound = round;
			return () => clearTimeout(timeout);
		}
		lastRound = round;
	});

	// Keep the phone awake from the countdown until the finish.
	$effect(() => {
		const active = phase === 'countdown' || phase === 'running' || phase === 'paused';
		if (!active || !('wakeLock' in navigator)) return;
		let lock: WakeLockSentinel | null = null;
		let cancelled = false;
		const acquire = () => {
			navigator.wakeLock
				.request('screen')
				.then((sentinel) => {
					if (cancelled) void sentinel.release();
					else lock = sentinel;
				})
				.catch(() => {});
		};
		const onVisible = () => {
			if (document.visibilityState === 'visible') acquire();
		};
		acquire();
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			cancelled = true;
			document.removeEventListener('visibilitychange', onVisible);
			void lock?.release();
		};
	});

	$effect(() => {
		const onChange = () => (isFullscreen = !!document.fullscreenElement);
		document.addEventListener('fullscreenchange', onChange);
		return () => {
			document.removeEventListener('fullscreenchange', onChange);
			if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		};
	});

	// Leaving by the back button must not leave a clock ticking (and talking) in the background.
	onDestroy(() => timerStore.reset());

	function toggleFullscreen() {
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		else void root?.requestFullscreen?.().catch(() => {});
	}

	function toggleBoard() {
		boardPref = !boardPref;
		try {
			localStorage.setItem(BOARD_PREF, boardPref ? '1' : '0');
		} catch {
			// not remembered
		}
	}

	function start() {
		audioService.unlockAudio();
		void timerStore.start();
	}

	function exit() {
		if (phase === 'countdown' || phase === 'running' || phase === 'paused') {
			if (phase === 'running') timerStore.pause();
			exitOpen = true;
			return;
		}
		leave();
	}

	function leave() {
		exitOpen = false;
		timerStore.reset();
		onexit();
	}

	function onKeydown(event: KeyboardEvent) {
		if (exitOpen || event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select')) return;
		const key = event.key.toLowerCase();

		if (key === ' ' || key === 'spacebar') {
			if (target?.closest('button, a')) return; // let the focused control handle it
			event.preventDefault();
			if (phase === 'idle') start();
			else if (phase === 'running') timerStore.pause();
			else if (phase === 'paused') timerStore.resume();
		} else if (key === 'r' && phase === 'running' && counting) {
			timerStore.incrementRounds();
		} else if (key === 'f' && (phase === 'running' || phase === 'paused') && type === 'fortime') {
			timerStore.stop();
		} else if (key === 'm') {
			audioService.toggleMute();
		} else if (key === 'escape') {
			exit();
		}
	}

	// --- The result ------------------------------------------------------------

	const result = $derived.by(() => {
		const elapsed = formatTimeMs(timerStore.elapsedMs);
		const total = formatTimeMs(timerStore.totalMs);
		const rounds = timerStore.completedRounds;
		const words = t.timer.result;

		if (type === 'fortime') {
			return timerStore.endedEarly
				? {
						big: elapsed,
						label: words.time,
						extra: rounds > 0 ? words.roundsLogged(rounds) : words.cap(total)
					}
				: {
						big: total,
						label: words.timeCap,
						extra: rounds > 0 ? words.roundsLogged(rounds) : words.capped
					};
		}
		if (type === 'amrap') {
			if (rounds > 0)
				return {
					big: String(rounds),
					label: words.roundWord(rounds),
					extra: timerStore.endedEarly ? words.stoppedAtTime(elapsed) : words.inTime(total)
				};
			return {
				big: timerStore.endedEarly ? elapsed : total,
				label: timerStore.endedEarly ? words.stoppedAt : words.amrapDone,
				extra: strip[1]
			};
		}
		return timerStore.endedEarly
			? {
					big: elapsed,
					label: words.stoppedAt,
					extra: words.roundOf(timerStore.currentRound, timerStore.totalRounds)
				}
			: { big: total, label: words.roundsDone(timerStore.totalRounds), extra: strip[1] };
	});

	const dateLabel = $derived(formatShort(context?.date ?? todayIso()));

	async function share() {
		const text = `${name}: ${result.big}${result.label ? ` (${result.label.toLowerCase()})` : ''} · ${strip[0]} ${strip[1]} · RolimBox, ${dateLabel}`;
		try {
			if (navigator.share) {
				await navigator.share({ text });
				return;
			}
			await navigator.clipboard.writeText(text);
			toastStore.success(t.timer.result.copied);
		} catch (error) {
			if ((error as Error)?.name !== 'AbortError') {
				toastStore.error(t.timer.result.shareFailed);
			}
		}
	}

	const segments = $derived(intervals ? Math.min(timerStore.totalRounds, 60) : 0);
	const segmentList = $derived(Array.from({ length: segments }, (_, index) => index));
	const roundProgress = $derived.by(() => {
		if (!config || !intervals) return 0;
		const length =
			type === 'emom'
				? config.intervalWork! * 1000
				: (config.intervalWork! + config.intervalRest!) * 1000;
		return Math.min(1, (timerStore.elapsedMs % length) / length);
	});
</script>

<svelte:window onkeydown={onKeydown} />

{#if config}
	<div
		bind:this={root}
		class="clock"
		class:flood
		class:paused={phase === 'paused'}
		class:finished={phase === 'completed'}
		data-state={phase}
		data-phase={type === 'tabata' && phase === 'running' ? (working ? 'work' : 'rest') : undefined}
	>
		{#if phase === 'completed'}
			<!-- The finish line -->
			<div class="band chequer" aria-hidden="true"></div>
			<div class="finish">
				<p class="flex items-center justify-between gap-3 legend">
					<span>{dateLabel}</span>
					<span>RolimBox</span>
				</p>

				<p class="acabou sign" lang="pt-BR">Acabou!</p>

				<h1 class="finish-name display">
					<span use:fitText={{ max: 120, min: 40, key: name }}>{name}</span>
				</h1>

				<div
					class="result"
					role="status"
					aria-label={t.timer.result.aria(result.big, result.label)}
				>
					<p class="result-big display">
						<span use:fitText={{ max: 360, min: 96, key: result.big }}>{result.big}</span>
					</p>
					<p class="result-label display">{result.label}</p>
				</div>

				<div class="strip">
					<span class="cell">{strip[0]}</span>
					<span class="cell">{result.extra}</span>
				</div>

				<div class="finish-actions">
					<button
						type="button"
						class="btn btn-pink btn-slab"
						onclick={share}
						aria-label={t.timer.result.shareAria}
					>
						<Icon name="share" size={24} stroke={2.8} />
						<span lang="pt-BR">Manda no grupo</span>
					</button>
					<div class="grid grid-cols-2 gap-2">
						<button type="button" class="btn" onclick={() => timerStore.reset()}>
							<Icon name="rotate" size={18} stroke={2.8} />
							{t.timer.result.goAgain}
						</button>
						<button type="button" class="btn" onclick={leave}>
							{context?.wodId ? t.timer.result.backToWod : t.timer.result.done}
						</button>
					</div>
				</div>
			</div>
			<div class="band chequer" aria-hidden="true"></div>
		{:else}
			{#if phase === 'paused'}<div class="tape hazard" aria-hidden="true"></div>{/if}

			<header class="top">
				<button type="button" class="icon-btn" onclick={exit} aria-label={t.timer.run.leaveAria}>
					<Icon name="x" size={24} stroke={2.8} />
				</button>
				<div class="min-w-0 flex-1">
					<p class="truncate legend opacity-80">{strip[0]} · {strip[1]}</p>
					<h1 class="truncate display text-[1.75rem] leading-none lg:text-[2.5rem]">{name}</h1>
				</div>
				{#if content && phase !== 'idle' && phase !== 'countdown'}
					<button
						type="button"
						class="icon-btn"
						class:on={boardPref}
						onclick={toggleBoard}
						aria-pressed={boardPref}
						aria-label={t.timer.run.boardAria}
					>
						<Icon name="board" size={22} stroke={2.4} />
					</button>
				{/if}
				<button
					type="button"
					class="icon-btn max-lg:hidden"
					onclick={toggleFullscreen}
					aria-label={isFullscreen ? t.timer.run.leaveFullscreen : t.timer.run.fullscreen}
				>
					<Icon name="expand" size={22} stroke={2.4} />
				</button>
				<button
					type="button"
					class="icon-btn"
					onclick={() => audioService.toggleMute()}
					aria-pressed={audioService.isMuted}
					aria-label={audioService.isMuted ? t.timer.run.soundOff : t.timer.run.soundOn}
				>
					<Icon name={audioService.isMuted ? 'volume-off' : 'volume'} size={22} stroke={2.4} />
				</button>
			</header>

			<!-- Round / phase line -->
			<div class="status">
				{#if intervals}
					<p class="flex items-baseline gap-2.5">
						<span class="legend opacity-80">{t.timer.run.round}</span>
						<span class="display text-[2.75rem] lg:text-[4rem]">
							{String(timerStore.currentRound).padStart(2, '0')}<span class="opacity-50"
								>/{String(timerStore.totalRounds).padStart(2, '0')}</span
							>
						</span>
					</p>
					{#if type === 'tabata'}
						<p class="phase-word display" aria-live="assertive">
							{phase === 'idle' || phase === 'countdown'
								? t.timer.run.ready
								: working
									? t.timer.run.work
									: t.timer.run.rest}
						</p>
					{:else if phase === 'paused'}
						<p class="tag tag-warn">{t.timer.run.paused}</p>
					{/if}
				{:else}
					<div class="flex items-center gap-2.5">
						<span class="legend opacity-80">{t.timer.run.rounds}</span>
						<span class="min-w-[1.2ch] display text-[2.75rem] lg:text-[4rem]" aria-live="polite"
							>{timerStore.completedRounds}</span
						>
						{#if phase === 'running' || phase === 'paused'}
							<button
								type="button"
								class="icon-btn"
								onclick={() => timerStore.decrementRounds()}
								disabled={timerStore.completedRounds === 0}
								aria-label={t.timer.run.takeBack}
							>
								<Icon name="minus" size={20} stroke={3.2} />
							</button>
							{#if type === 'fortime'}
								<button
									type="button"
									class="icon-btn"
									onclick={() => timerStore.incrementRounds()}
									aria-label={t.timer.run.countRound}
								>
									<Icon name="plus" size={20} stroke={3.2} />
								</button>
							{/if}
						{/if}
					</div>
					{#if phase === 'paused'}
						<p class="tag tag-warn">{t.timer.run.paused}</p>
					{:else}
						<p class="legend opacity-80">
							{type === 'fortime' ? strip[1] : t.timer.run.of(strip[1])}
						</p>
					{/if}
				{/if}
			</div>

			<!-- The digits (and, when asked for, the workout beside them) -->
			<div class="field" class:split={boardVisible}>
				<div class="digits" class:compact={boardVisible}>
					{#key urgent ? second : 0}
						<p
							class="time display"
							class:beat={urgent}
							class:blink={phase === 'paused'}
							role="timer"
							aria-label={t.timer.run.timeAria(time[0], time[1])}
						>
							<span>{time[0]}</span><span class="colon" aria-hidden="true">:</span><span
								>{time[1]}</span
							>
						</p>
					{/key}
				</div>

				{#if boardVisible}
					<div class="workout" use:fitBox={{ min: 18, max: 72, key: content }}>
						<Board {content} accent />
					</div>
				{/if}
			</div>

			{#if !boardVisible && slot && (phase === 'running' || phase === 'paused')}
				<div class="now">
					<p class="legend opacity-80">{t.timer.run.now}</p>
					<p class="display-wide text-[2rem] leading-none lg:text-[3rem]">{slot.now}</p>
					{#if slot.next}
						<p class="mt-2 truncate legend opacity-80">{t.timer.run.next(slot.next)}</p>
					{/if}
				</div>
			{/if}

			<!-- Progress -->
			{#if intervals}
				<div class="segments" style="--n: {segments}" aria-hidden="true">
					{#each segmentList as index (index)}
						<span
							class="seg"
							class:done={index + 1 < timerStore.currentRound}
							class:current={index + 1 === timerStore.currentRound && phase !== 'idle'}
							style={index + 1 === timerStore.currentRound
								? `--fill: ${roundProgress * 100}%`
								: undefined}
						></span>
					{/each}
				</div>
			{:else}
				<div class="bar" aria-hidden="true">
					<span style="width: {timerStore.progress * 100}%"></span>
				</div>
			{/if}

			<!-- Controls: one slab for the thing you need right now -->
			<div class="controls">
				{#if phase === 'idle'}
					<button type="button" class="btn btn-pink btn-slab go" onclick={start}>
						<Icon name="play" solid size={28} />
						{t.timer.run.start}
					</button>
				{:else if phase === 'countdown'}
					<button type="button" class="btn btn-slab" onclick={() => timerStore.reset()}
						>{t.timer.run.cancel}</button
					>
				{:else if phase === 'running'}
					<div class="row">
						{#if type === 'amrap'}
							<button
								type="button"
								class="btn btn-pink btn-slab go"
								onclick={() => timerStore.incrementRounds()}
								aria-label={t.timer.run.countRound}
							>
								<Icon name="plus" size={28} stroke={3.6} />
								{t.timer.run.roundButton}
							</button>
						{:else if type === 'fortime'}
							<button
								type="button"
								class="btn btn-pink btn-slab go"
								onclick={() => timerStore.stop()}
							>
								<Icon name="flag" size={26} stroke={2.8} />
								{t.timer.run.finish}
							</button>
						{/if}
						<button
							type="button"
							class="btn btn-slab {counting ? 'side' : 'go'}"
							onclick={() => timerStore.pause()}
						>
							<Icon name="pause" solid size={24} />
							{t.timer.run.pause}
						</button>
					</div>
				{:else if phase === 'paused'}
					<button
						type="button"
						class="btn btn-warn btn-slab go"
						onclick={() => timerStore.resume()}
					>
						<Icon name="play" solid size={28} />
						{t.timer.run.resume}
					</button>
					<div class="row mt-2">
						<button type="button" class="btn flex-1" onclick={() => timerStore.reset()}>
							<Icon name="rotate" size={18} stroke={2.8} />
							{t.timer.run.reset}
						</button>
						<button type="button" class="btn flex-1" onclick={() => timerStore.stop()}>
							<Icon name="flag" size={18} stroke={2.8} />
							{type === 'fortime' ? t.timer.run.finish : t.timer.run.endHere}
						</button>
					</div>
				{/if}
			</div>

			{#if phase === 'paused'}<div class="tape hazard" aria-hidden="true"></div>{/if}

			<!-- 3, 2, 1, bora -->
			{#if phase === 'countdown' && timerStore.countdownValue !== null}
				<div class="countdown" aria-live="assertive">
					{#key timerStore.countdownValue}
						{#if timerStore.countdownValue === 'GO'}
							<p class="bora sign" lang="pt-BR">Bora!</p>
							<span class="sr-only">{t.timer.run.go}</span>
						{:else}
							<p class="count display">{timerStore.countdownValue}</p>
						{/if}
					{/key}
				</div>
			{/if}
		{/if}
	</div>
{/if}

<ConfirmDialog
	bind:open={exitOpen}
	title={t.timer.leave.title}
	message={t.timer.leave.message}
	confirmLabel={t.timer.leave.confirm}
	cancelLabel={t.timer.leave.cancel}
	danger
	onconfirm={leave}
/>

<style>
	.clock {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: calc(0.75rem + var(--safe-top)) calc(1rem + var(--safe-right))
			calc(0.75rem + var(--safe-bottom)) calc(1rem + var(--safe-left));
		background: var(--c-bg);
		color: var(--c-ink);
		overflow: hidden;
		user-select: none;
		-webkit-user-select: none;
	}

	/* Pink means move: everything inside re-reads its colours from the flooded ground. */
	.clock.flood {
		--c-bg: #ff2e93;
		--c-panel: #ff2e93;
		--c-raised: #ff5aa9;
		--c-ink: #0c0c0d;
		--c-dim: #0c0c0d;
		--c-mute: #3d0a23;
		--c-line: color-mix(in srgb, #0c0c0d 30%, transparent);
		--c-line-strong: #0c0c0d;
		--c-pink-ink: #0c0c0d;
		--c-pink: #0c0c0d;
		--c-on-fill: #ff2e93;
		--c-warn-ink: #0c0c0d;
	}

	.top {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}
	.icon-btn.on {
		background: var(--c-ink);
		border-color: var(--c-ink);
		color: var(--c-bg);
	}

	.status {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		position: relative;
		z-index: 1;
		min-height: 3.5rem;
		padding-top: 0.25rem;
		border-top: 2px solid var(--c-ink);
	}
	.phase-word {
		font-size: 2.75rem;
		padding: 0.08em 0.25em 0;
		background: var(--c-ink);
		color: var(--c-bg);
	}

	/* --- Digits --- */
	.field {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.digits {
		flex: 1;
		min-height: 0;
		min-width: 0;
		container-type: size;
		display: flex;
		align-items: center;
		justify-content: center;
		/* The glyph boxes are taller than the digits look. They must never swallow a tap meant
		   for the round counter above or the slab below. */
		pointer-events: none;
	}
	.time {
		display: flex;
		flex-direction: column;
		align-items: center;
		font-size: min(111cqw, 60cqh);
		line-height: 0.8;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}
	.time .colon {
		display: none;
	}
	@container (min-aspect-ratio: 5/4) {
		.time {
			flex-direction: row;
			font-size: min(49cqw, 122cqh);
		}
		.time .colon {
			display: inline;
		}
	}
	.digits.compact {
		flex: 0 0 auto;
		height: clamp(5.5rem, 22dvh, 13rem);
	}
	.time.beat {
		color: var(--c-pink-ink);
		animation: slam-in 0.16s var(--ease-snap) both;
	}
	.flood .time.beat {
		color: var(--c-ink);
	}
	@keyframes slam-in {
		from {
			transform: scale(1.06);
		}
		to {
			transform: none;
		}
	}
	.time.blink {
		animation: var(--animate-blink);
	}

	.workout {
		flex: 1;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
		padding-top: 0.25rem;
		border-top: 2px solid var(--c-ink);
	}
	.workout :global(.text),
	.workout :global(.note),
	.workout :global(.heading) {
		overflow-wrap: normal;
	}
	/* Wide screens (a propped phone on its side, a laptop, the TV): clock left, workout right. */
	@media (orientation: landscape) and (min-width: 640px) {
		.field.split {
			flex-direction: row;
			gap: 1.5rem;
		}
		.field.split .digits.compact {
			flex: 3;
			height: auto;
		}
		.field.split .workout {
			flex: 2;
			padding: 0 0 0 1.5rem;
			border-top: 0;
			border-left: 2px solid var(--c-ink);
		}
	}
	.now {
		padding: 0.5rem 0 0.25rem;
		border-top: 2px solid var(--c-ink);
	}

	/* --- Progress --- */
	.bar {
		height: 0.75rem;
		background: var(--c-line);
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--c-ink);
	}
	.segments {
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 1fr));
		gap: 3px;
		height: 0.75rem;
	}
	.seg {
		background: var(--c-line);
	}
	.seg.done {
		background: var(--c-ink);
	}
	.seg.current {
		background: linear-gradient(
			to right,
			var(--c-ink) var(--fill, 0%),
			var(--c-line) var(--fill, 0%)
		);
		outline: 2px solid var(--c-ink);
		outline-offset: -2px;
	}

	/* --- Controls --- */
	.controls {
		padding-top: 0.25rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
	}
	.go {
		min-height: 5.5rem;
		font-size: 2.5rem;
		flex: 1;
	}
	.side {
		width: 34%;
		min-height: 5.5rem;
		font-size: 1.375rem;
		flex-direction: column;
		gap: 0.375rem;
	}
	.btn:focus-visible {
		outline-color: var(--c-ink);
	}

	/* --- Paused --- */
	.tape {
		flex: none;
		height: 0.875rem;
		margin-inline: calc(-1rem - var(--safe-left)) calc(-1rem - var(--safe-right));
	}
	.tape:first-child {
		margin-top: calc(-0.75rem - var(--safe-top));
		padding-top: var(--safe-top);
		box-sizing: content-box;
	}
	.tape:last-of-type {
		margin-bottom: calc(-0.75rem - var(--safe-bottom));
	}

	/* --- Countdown --- */
	.countdown {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--c-bg);
		container-type: size;
		pointer-events: none;
	}
	.count {
		font-size: min(120cqw, 82cqh);
		line-height: 0.8;
		animation: var(--animate-slam);
	}
	.bora {
		font-size: min(40cqw, 46cqh);
		color: #0c0c0d;
		text-shadow: 0.05em 0.05em 0 #f3efe6;
		transform: rotate(-6deg);
		animation: bora-in 0.18s var(--ease-snap) both;
	}
	@keyframes bora-in {
		from {
			transform: rotate(-14deg) scale(1.5);
		}
		to {
			transform: rotate(-6deg);
		}
	}

	/* --- Finish line --- */
	.finished {
		padding: 0;
		gap: 0;
	}
	.band {
		flex: none;
		height: calc(1.75rem + var(--safe-top));
	}
	.band:last-child {
		height: calc(1.75rem + var(--safe-bottom));
	}
	.finish {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		padding: 0.875rem calc(1rem + var(--safe-right)) 0.875rem calc(1rem + var(--safe-left));
		overflow-y: auto;
		container-type: inline-size;
	}
	.acabou {
		align-self: flex-start;
		margin-top: 0.75rem;
		font-size: clamp(3.5rem, 19cqw, 7rem);
		color: #0c0c0d;
		text-shadow: 0.045em 0.045em 0 #f3efe6;
		transform: rotate(-5deg);
		transform-origin: left bottom;
		animation: var(--animate-slap);
		--tilt: -5deg;
	}
	.finish-name {
		margin-top: 1rem;
		font-size: 3rem;
		line-height: 0.86;
		overflow-wrap: anywhere;
	}
	.result {
		pointer-events: none;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding-block: 0.5rem;
	}
	.result-big {
		font-size: 10rem;
		line-height: 0.8;
		animation: var(--animate-slam);
		animation-delay: 0.12s;
	}
	.result-label {
		margin-top: 0.5rem;
		font-size: clamp(1.75rem, 8cqw, 3rem);
	}
	.strip {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		border: 2px solid #0c0c0d;
	}
	.cell {
		padding: 0.5rem 0.75rem 0.4rem;
		font-family: var(--font-mono);
		font-stretch: 75%;
		font-weight: 700;
		font-size: 0.8125rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cell:first-child {
		background: #0c0c0d;
		color: #ff2e93;
	}
	.finish-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.875rem;
	}

	@media (min-width: 1024px) {
		.clock:not(.finished) {
			padding: 1.25rem 2rem;
			gap: 0.75rem;
		}
		.controls {
			display: flex;
			flex-direction: column;
			align-items: center;
		}
		.controls > :global(*) {
			width: min(44rem, 100%);
		}
		.finish {
			padding: 1.5rem 2.5rem;
			max-width: 64rem;
			width: 100%;
			margin-inline: auto;
		}
		.finish-actions {
			flex-direction: row;
		}
		.finish-actions > :global(*) {
			flex: 1;
		}
		.finish-actions :global(.btn) {
			min-height: 4.5rem;
		}
	}

	@media (orientation: landscape) and (max-height: 520px) {
		.status {
			min-height: 2.5rem;
		}
		.go,
		.side {
			min-height: 3.5rem;
			font-size: 1.75rem;
		}
		.side {
			flex-direction: row;
		}
	}
</style>
