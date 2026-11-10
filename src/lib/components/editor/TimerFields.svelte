<script lang="ts">
	import {
		TIMER_DEFAULTS,
		TIMER_LABELS,
		TIMER_TYPES,
		getTotalDuration,
		type TimerConfig,
		type TimerType
	} from '$lib/types/timer';
	import { clock } from '$lib/wod-format';

	/** Compact clock settings for a section in the editor: pick a format, type the numbers. */
	interface Props {
		/** Unique prefix for field ids. */
		id: string;
		timer: TimerConfig | null;
	}

	let { id, timer = $bindable() }: Props = $props();

	function pick(type: TimerType | null) {
		if (type === null) timer = null;
		else if (timer?.type !== type) timer = { ...TIMER_DEFAULTS[type] };
	}

	function set(field: 'duration' | 'rounds' | 'intervalWork' | 'intervalRest', raw: string) {
		if (!timer) return;
		const limits = {
			duration: [1, 60],
			rounds: timer.type === 'tabata' ? [1, 20] : [1, 50],
			intervalWork: timer.type === 'tabata' ? [5, 60] : [10, 300],
			intervalRest: [5, 60]
		}[field];
		let value = Math.round(Number(raw));
		if (!Number.isFinite(value)) return;
		value = Math.min(limits[1], Math.max(limits[0], value));
		timer = { ...timer, [field]: field === 'duration' ? value * 60 : value };
	}

	const minutes = $derived(timer?.duration ? Math.round(timer.duration / 60) : 0);
</script>

<fieldset>
	<legend class="field-label">Clock</legend>
	<div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Clock format">
		<button
			type="button"
			role="radio"
			aria-checked={timer === null}
			class="tag min-h-11 px-3 {timer === null ? 'tag-ink' : ''}"
			onclick={() => pick(null)}
		>
			No clock
		</button>
		{#each TIMER_TYPES as type (type)}
			<button
				type="button"
				role="radio"
				aria-checked={timer?.type === type}
				class="tag min-h-11 px-3 {timer?.type === type ? 'tag-pink' : ''}"
				onclick={() => pick(type)}
			>
				{TIMER_LABELS[type]}
			</button>
		{/each}
	</div>

	{#if timer}
		<div class="mt-3 flex flex-wrap items-end gap-3">
			{#if timer.type === 'amrap' || timer.type === 'fortime'}
				<div class="w-28">
					<label for="{id}-minutes" class="field-label">
						{timer.type === 'fortime' ? 'Cap (min)' : 'Minutes'}
					</label>
					<input
						id="{id}-minutes"
						type="number"
						inputmode="numeric"
						class="input num"
						min="1"
						max="60"
						value={minutes}
						onchange={(e) => set('duration', e.currentTarget.value)}
					/>
				</div>
			{:else if timer.type === 'emom'}
				<div class="w-28">
					<label for="{id}-rounds" class="field-label">Rounds</label>
					<input
						id="{id}-rounds"
						type="number"
						inputmode="numeric"
						class="input num"
						min="1"
						max="50"
						value={timer.rounds}
						onchange={(e) => set('rounds', e.currentTarget.value)}
					/>
				</div>
				<div class="w-28">
					<label for="{id}-every" class="field-label">Every (s)</label>
					<input
						id="{id}-every"
						type="number"
						inputmode="numeric"
						class="input num"
						min="10"
						max="300"
						step="5"
						value={timer.intervalWork}
						onchange={(e) => set('intervalWork', e.currentTarget.value)}
					/>
				</div>
			{:else}
				<div class="w-24">
					<label for="{id}-rounds" class="field-label">Rounds</label>
					<input
						id="{id}-rounds"
						type="number"
						inputmode="numeric"
						class="input num"
						min="1"
						max="20"
						value={timer.rounds}
						onchange={(e) => set('rounds', e.currentTarget.value)}
					/>
				</div>
				<div class="w-24">
					<label for="{id}-work" class="field-label">Work (s)</label>
					<input
						id="{id}-work"
						type="number"
						inputmode="numeric"
						class="input num"
						min="5"
						max="60"
						step="5"
						value={timer.intervalWork}
						onchange={(e) => set('intervalWork', e.currentTarget.value)}
					/>
				</div>
				<div class="w-24">
					<label for="{id}-rest" class="field-label">Rest (s)</label>
					<input
						id="{id}-rest"
						type="number"
						inputmode="numeric"
						class="input num"
						min="5"
						max="60"
						step="5"
						value={timer.intervalRest}
						onchange={(e) => set('intervalRest', e.currentTarget.value)}
					/>
				</div>
			{/if}
			<p class="pb-5 legend text-mute">Total {clock(getTotalDuration(timer))}</p>
		</div>
	{/if}
</fieldset>
