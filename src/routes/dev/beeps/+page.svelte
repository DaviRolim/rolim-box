<!-- src/routes/dev/beeps/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import audioConfigJson from '$lib/config/audio-config.json';
	import { audioService } from '$lib/services/audio.svelte';
	import type { AudioConfig, BeepConfig } from '$lib/types/audio';

	type BeepEntry = {
		id: string;
		label: string;
		config: BeepConfig;
	};

	const config = audioConfigJson as AudioConfig;

	const beepEntries: BeepEntry[] = [
		{
			id: 'universal.countdown.3',
			label: 'Countdown: 3',
			config: config.universal.countdown['3']
		},
		{
			id: 'universal.countdown.2',
			label: 'Countdown: 2',
			config: config.universal.countdown['2']
		},
		{
			id: 'universal.countdown.1',
			label: 'Countdown: 1',
			config: config.universal.countdown['1']
		},
		{
			id: 'emom.roundWarning',
			label: 'EMOM: round warning (10s remaining)',
			config: config.emom.roundWarning
		},
		{
			id: 'emom.roundCountdown.3',
			label: 'EMOM: round countdown (3)',
			config: config.emom.roundCountdown['3']
		},
		{
			id: 'emom.roundCountdown.2',
			label: 'EMOM: round countdown (2)',
			config: config.emom.roundCountdown['2']
		},
		{
			id: 'emom.roundCountdown.1',
			label: 'EMOM: round countdown (1)',
			config: config.emom.roundCountdown['1']
		}
	];

	let manualFrequency = $state(660);
	let manualDuration = $state(150);
	let isMuted = $state(false);
	let isPlayingSequence = $state(false);

	onMount(() => {
		// Ensure we start unmuted for testing. (Users can toggle if needed.)
		audioService.unmute();
		isMuted = audioService.isMuted;
	});

	function toggleMute() {
		audioService.toggleMute();
		isMuted = audioService.isMuted;
	}

	function clampInt(value: number, min: number, max: number) {
		return Math.max(min, Math.min(max, Math.round(value)));
	}

	async function playBeep(frequency: number, duration: number) {
		await audioService.playBeep(clampInt(frequency, 20, 20000), clampInt(duration, 10, 5000));
	}

	function sleep(ms: number) {
		return new Promise<void>((resolve) => setTimeout(resolve, ms));
	}

	async function playCountdownSequence() {
		if (isPlayingSequence) return;
		isPlayingSequence = true;
		try {
			// Play 3..2..1 with ~1s spacing (using the actual config values).
			for (const sec of [3, 2, 1] as const) {
				await audioService.playCountdownBeep(sec);
				await sleep(1000);
			}
		} finally {
			isPlayingSequence = false;
		}
	}
</script>

<svelte:head>
	<title>Beep Lab (dev) - RolimBox</title>
</svelte:head>

<div class="page">
	<header class="header">
		<div class="title">
			<h1>Beep Lab</h1>
			<p>
				Click play to preview beep settings from <code>src/lib/config/audio-config.json</code>.
				Edit the JSON, save, and click again (Vite HMR will refresh this page automatically).
			</p>
		</div>

		<div class="actions">
			<button type="button" class="btn secondary" onclick={toggleMute}>
				{isMuted ? 'Unmute' : 'Mute'}
			</button>
			<button
				type="button"
				class="btn"
				disabled={isPlayingSequence}
				onclick={playCountdownSequence}
				title="Plays 3, 2, 1 using config values"
			>
				{isPlayingSequence ? 'Playing…' : 'Play 3-2-1'}
			</button>
		</div>
	</header>

	<section class="card">
		<h2>Config beeps</h2>
		<div class="grid">
			{#each beepEntries as entry (entry.id)}
				<div class="row">
					<div class="meta">
						<div class="label">{entry.label}</div>
						<div class="sub">
							<code>{entry.id}</code>
							<span class="dot">•</span>
							<span>{entry.config.frequency} Hz</span>
							<span class="dot">•</span>
							<span>{entry.config.duration} ms</span>
						</div>
					</div>
					<div class="controls">
						<button
							type="button"
							class="btn"
							onclick={() => playBeep(entry.config.frequency, entry.config.duration)}
						>
							Play
						</button>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="card">
		<h2>Manual quick test</h2>
		<div class="manual">
			<label class="field">
				<span>Frequency (Hz)</span>
				<input
					type="number"
					min="20"
					max="20000"
					step="1"
					bind:value={manualFrequency}
					inputmode="numeric"
				/>
			</label>

			<label class="field">
				<span>Duration (ms)</span>
				<input
					type="number"
					min="10"
					max="5000"
					step="10"
					bind:value={manualDuration}
					inputmode="numeric"
				/>
			</label>

			<div class="controls">
				<button type="button" class="btn" onclick={() => playBeep(manualFrequency, manualDuration)}>
					Play
				</button>
				<button type="button" class="btn secondary" onclick={() => playBeep(manualFrequency, 50)}>
					Short (50ms)
				</button>
				<button type="button" class="btn secondary" onclick={() => playBeep(manualFrequency, 150)}>
					Medium (150ms)
				</button>
				<button type="button" class="btn secondary" onclick={() => playBeep(manualFrequency, 300)}>
					Long (300ms)
				</button>
			</div>
		</div>
	</section>
</div>

<style>
	.page {
		min-height: 100vh;
		padding: 24px 20px 60px;
		background: #0a0a0a;
		color: #e5e5e5;
		font-family: 'Inter', system-ui, sans-serif;
	}

	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		font-size: 0.9em;
	}

	.header {
		max-width: 900px;
		margin: 0 auto 20px;
		display: flex;
		gap: 16px;
		align-items: flex-start;
		justify-content: space-between;
	}

	.title h1 {
		margin: 0 0 6px;
		font-size: 28px;
		font-weight: 900;
		letter-spacing: 0.02em;
	}

	.title p {
		margin: 0;
		color: #a3a3a3;
		line-height: 1.35;
		max-width: 64ch;
	}

	.actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.card {
		max-width: 900px;
		margin: 0 auto 16px;
		border: 1px solid #202020;
		background: #121212;
		border-radius: 14px;
		padding: 16px;
	}

	.card h2 {
		margin: 0 0 12px;
		font-size: 14px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #c7c7c7;
	}

	.grid {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px;
		border-radius: 12px;
		background: #0f0f0f;
		border: 1px solid #1f1f1f;
	}

	.label {
		font-weight: 800;
		color: #ffffff;
	}

	.sub {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #a3a3a3;
		margin-top: 4px;
		flex-wrap: wrap;
	}

	.dot {
		opacity: 0.6;
	}

	.manual {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field span {
		color: #a3a3a3;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	input {
		background: #0b0b0b;
		border: 1px solid #2a2a2a;
		border-radius: 10px;
		color: #ffffff;
		padding: 12px 12px;
		font-size: 14px;
		outline: none;
		min-height: 44px;
	}

	input:focus {
		border-color: #6e489f;
		box-shadow: 0 0 0 3px rgba(110, 72, 159, 0.25);
	}

	.controls {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
	}

	.btn {
		background: linear-gradient(135deg, #e91e8c 0%, #be185d 100%);
		border: 2px solid #e91e8c;
		color: #ffffff;
		padding: 10px 14px;
		border-radius: 12px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: 12px;
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
		min-height: 44px;
	}

	.btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 18px rgba(233, 30, 140, 0.25);
	}

	.btn:active {
		transform: translateY(0);
	}

	.btn.secondary {
		background: transparent;
		border-color: #2a2a2a;
		color: #d4d4d4;
		box-shadow: none;
	}

	.btn.secondary:hover {
		border-color: #6e489f;
		color: #ffffff;
		box-shadow: none;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
		box-shadow: none;
	}

	@media (max-width: 720px) {
		.header {
			flex-direction: column;
			align-items: stretch;
		}

		.actions {
			justify-content: flex-start;
		}

		.manual {
			grid-template-columns: 1fr;
		}

		.controls {
			justify-content: flex-start;
		}
	}
</style>


