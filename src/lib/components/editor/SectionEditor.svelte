<script lang="ts">
	import { sectionTypes } from '$lib/config/section-types';
	import { SECTION_TYPES, type SectionType } from '$lib/types/wod';
	import type { SectionDraft } from './types';
	import Icon from '$lib/components/ui/Icon.svelte';
	import TimerFields from './TimerFields.svelte';
	import { dictionaries, t } from '$lib/i18n';

	interface Props {
		draft: SectionDraft;
		index: number;
		count: number;
		/** Show validation messages. */
		showErrors?: boolean;
		onmove: (by: -1 | 1) => void;
		onremove: () => void;
	}

	let { draft = $bindable(), index, count, showErrors = false, onmove, onremove }: Props = $props();

	// Default names in every language: a name the coach never touched follows the type,
	// even if they switched language in between.
	const LABELS = new Set(
		Object.values(dictionaries).flatMap((dict) => Object.values(dict.format.sectionTypes))
	);
	const nameError = $derived(
		!draft.name.trim()
			? t.editor.errors.nameRequired
			: draft.name.length > 100
				? t.editor.errors.nameTooLong
				: ''
	);
	const contentError = $derived(draft.content.length > 2000 ? t.editor.errors.contentTooLong : '');
	const label = $derived(draft.name || t.editor.section.section);
	const rows = $derived(Math.min(18, Math.max(4, draft.content.split('\n').length + 1)));

	function changeType(type: SectionType) {
		// The name follows the type until the coach writes their own.
		if (!draft.name.trim() || LABELS.has(draft.name.trim())) draft.name = sectionTypes[type].label;
		draft.type = type;
	}

	function onKeydown(event: KeyboardEvent) {
		if (!event.altKey || event.metaKey || event.ctrlKey) return;
		if (event.key === 'ArrowUp' && index > 0) {
			event.preventDefault();
			onmove(-1);
		} else if (event.key === 'ArrowDown' && index < count - 1) {
			event.preventDefault();
			onmove(1);
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<fieldset class="section" class:main={draft.type === 'wod'} onkeydown={onKeydown}>
	<legend class="sr-only">
		{t.editor.section.legend(index + 1, draft.name || t.editor.section.unnamed)}
	</legend>

	<div class="flex items-center gap-2">
		<span class="index display" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
		<div class="min-w-0 flex-1">
			<label for="section-type-{draft.key}" class="sr-only"
				>{t.editor.section.typeLabel(index + 1)}</label
			>
			<select
				id="section-type-{draft.key}"
				class="input type"
				value={draft.type}
				onchange={(e) => changeType(e.currentTarget.value as SectionType)}
			>
				{#each SECTION_TYPES as type (type)}
					<option value={type}>{sectionTypes[type].label}</option>
				{/each}
			</select>
		</div>
		<button
			type="button"
			class="icon-btn"
			onclick={() => onmove(-1)}
			disabled={index === 0}
			aria-label={t.editor.section.moveUpAria(label)}
			title={t.editor.section.moveUpTitle}
		>
			<Icon name="arrow-up" size={20} stroke={2.6} />
		</button>
		<button
			type="button"
			class="icon-btn"
			onclick={() => onmove(1)}
			disabled={index === count - 1}
			aria-label={t.editor.section.moveDownAria(label)}
			title={t.editor.section.moveDownTitle}
		>
			<Icon name="arrow-down" size={20} stroke={2.6} />
		</button>
		<button
			type="button"
			class="icon-btn"
			onclick={onremove}
			aria-label={t.editor.section.removeAria(label)}
			title={t.editor.section.removeTitle}
		>
			<Icon name="trash" size={20} stroke={2.4} />
		</button>
	</div>

	<div class="mt-3">
		<label for="section-name-{draft.key}" class="field-label">{t.editor.section.name}</label>
		<input
			id="section-name-{draft.key}"
			type="text"
			class="input name"
			maxlength="100"
			autocomplete="off"
			placeholder={t.editor.section.namePlaceholder}
			bind:value={draft.name}
			aria-invalid={showErrors && !!nameError}
			aria-describedby={showErrors && nameError ? `section-name-error-${draft.key}` : undefined}
		/>
		{#if showErrors && nameError}
			<p id="section-name-error-{draft.key}" class="mt-1.5 text-base font-semibold text-danger-ink">
				{nameError}
			</p>
		{/if}
	</div>

	<div class="mt-3">
		<label for="section-content-{draft.key}" class="field-label">
			{t.editor.section.content}
			<span class="text-mute normal-case">{t.editor.section.contentHint}</span>
		</label>
		<textarea
			id="section-content-{draft.key}"
			class="input"
			{rows}
			placeholder={t.editor.section.example}
			bind:value={draft.content}
			aria-invalid={showErrors && !!contentError}
		></textarea>
		{#if contentError}
			<p class="mt-1.5 text-base font-semibold text-danger-ink">{contentError}</p>
		{/if}
	</div>

	<div class="mt-3">
		<TimerFields id="section-timer-{draft.key}" bind:timer={draft.timer} />
	</div>
</fieldset>

<style>
	.section {
		min-width: 0;
		margin: 0;
		padding: 0.875rem 0 1.25rem;
		border: 0;
		border-top: 2px solid var(--c-ink);
	}
	.section.main {
		border-top: 6px solid var(--c-pink);
	}
	.index {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.75rem;
		height: 3rem;
		padding-top: 0.1em;
		font-size: 1.75rem;
		background: var(--c-ink);
		color: var(--c-bg);
	}
	.main .index {
		background: var(--c-pink);
		color: var(--c-on-fill);
	}
	.type {
		min-height: 3rem;
		padding-block: 0.5rem;
		font-family: var(--font-mono);
		font-stretch: 75%;
		font-weight: 600;
		font-size: 1rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	/* On a phone the type sits between the index and three buttons: give the longer
	   Portuguese names ("Aquecimento", "Alongamento") the room the chevron was taking. */
	@media (max-width: 639px) {
		.type {
			padding-left: 0.625rem;
			padding-right: 1.75rem;
			font-size: 0.875rem;
			letter-spacing: 0.02em;
			background-position:
				calc(100% - 1rem) 50%,
				calc(100% - 0.625rem) 50%;
		}
	}
	.name {
		font-stretch: 68%;
		font-weight: 800;
		font-size: 1.5rem;
		text-transform: uppercase;
		line-height: 1.1;
	}
	.name::placeholder {
		font-weight: 600;
	}
</style>
