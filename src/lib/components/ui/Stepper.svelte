<script lang="ts">
	import Icon from './Icon.svelte';
	import { t } from '$lib/i18n';

	/** A number you change with two big keys. Made for chalky thumbs. */
	interface Props {
		id: string;
		label: string;
		value: number;
		min: number;
		max: number;
		step?: number;
		/** Shown after the number: "min", "s", "rounds". */
		unit?: string;
		onchange?: (value: number) => void;
	}

	let { id, label, value = $bindable(), min, max, step = 1, unit, onchange }: Props = $props();

	function set(next: number) {
		const clamped = Math.min(max, Math.max(min, Math.round(next)));
		if (Number.isNaN(clamped)) return;
		value = clamped;
		onchange?.(clamped);
	}
</script>

<div class="stepper">
	<label for={id} class="legend text-dim">{label}</label>
	<div class="keys">
		<button
			type="button"
			class="key"
			onclick={() => set(value - step)}
			disabled={value <= min}
			aria-label={t.common.less(label.toLowerCase())}
		>
			<Icon name="minus" size={28} stroke={3.5} />
		</button>
		<div class="readout">
			<input
				{id}
				type="number"
				inputmode="numeric"
				class="display"
				{min}
				{max}
				{step}
				{value}
				onchange={(event) => {
					set(Number(event.currentTarget.value));
					event.currentTarget.value = String(value);
				}}
			/>
			{#if unit}<span class="legend text-mute">{unit}</span>{/if}
		</div>
		<button
			type="button"
			class="key"
			onclick={() => set(value + step)}
			disabled={value >= max}
			aria-label={t.common.more(label.toLowerCase())}
		>
			<Icon name="plus" size={28} stroke={3.5} />
		</button>
	</div>
</div>

<style>
	.stepper {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.keys {
		display: grid;
		grid-template-columns: 4rem 1fr 4rem;
		border: 2px solid var(--c-ink);
		border-radius: 2px;
	}
	.key {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 4rem;
		color: var(--c-ink);
		background: var(--c-panel);
	}
	.key:first-child {
		border-right: 2px solid var(--c-ink);
	}
	.key:last-child {
		border-left: 2px solid var(--c-ink);
	}
	.key:active:not(:disabled) {
		background: var(--c-pink);
		color: var(--c-on-fill);
	}
	.key:disabled {
		color: var(--c-line-strong);
		cursor: not-allowed;
	}
	.readout {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.5rem;
		padding-inline: 0.5rem;
		min-width: 0;
	}
	input {
		width: 3ch;
		min-width: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--c-ink);
		font-size: 3rem;
		line-height: 4rem;
		text-align: center;
		appearance: textfield;
		-moz-appearance: textfield;
	}
	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input:focus-visible {
		outline: none;
		box-shadow: none;
		background: var(--c-raised);
	}
</style>
