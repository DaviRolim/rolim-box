<script lang="ts">
	import { tick } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { addDays, formatLong, isIsoDate, todayIso } from '$lib/date';
	import { sectionTypes } from '$lib/config/section-types';
	import { wodStore } from '$lib/stores/wods.svelte';
	import { syncStore } from '$lib/stores/sync.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { parseTimerConfig, serializeTimerConfig } from '$lib/types/timer';
	import { SECTION_TYPES, type SectionType, type WoD } from '$lib/types/wod';
	import { mainSection, wodTitle } from '$lib/wod-format';
	import { generateId } from '$lib/utils';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Poster from '$lib/components/wod/Poster.svelte';
	import SectionBlock from '$lib/components/wod/SectionBlock.svelte';
	import SectionEditor from './SectionEditor.svelte';
	import type { SectionDraft } from './types';
	import { t } from '$lib/i18n';

	/**
	 * The coach's bench. Everything is edited in place: no dialogs, no steps. The right-hand side
	 * (or the Preview tab on a phone) shows the board exactly as athletes will get it.
	 */
	interface Props {
		/** The WoD being edited, or null for a new one. */
		wod: WoD | null;
		workspaceId: string;
		/** Whether the server can run the Magic Wand. */
		aiEnabled: boolean;
		/** Date to start on for a new WoD. */
		initialDate?: string;
	}

	let { wod, workspaceId, aiEnabled, initialDate }: Props = $props();

	const today = todayIso();
	const isNew = $derived(wod === null);
	const backHref = $derived(
		wod ? resolve('/(app)/workouts/[id]', { id: wod.id }) : resolve('/workouts')
	);

	/** A new WoD starts on the first day from today that has nothing programmed. */
	function firstOpenDay(): string {
		for (let offset = 0; offset < 14; offset++) {
			const day = addDays(today, offset);
			if (wodStore.onDate(day).length === 0) return day;
		}
		return today;
	}

	function toDrafts(source: WoD | null): SectionDraft[] {
		return (source?.sections ?? []).map((s) => ({
			key: s.id,
			type: s.type,
			name: s.name,
			content: s.content,
			timer: parseTimerConfig(s.timerConfig)
		}));
	}

	// The editor works on its own copy; the WoD it was opened with is only the starting point.
	// svelte-ignore state_referenced_locally
	let date = $state(
		wod?.date ?? (initialDate && isIsoDate(initialDate) ? initialDate : firstOpenDay())
	);
	// svelte-ignore state_referenced_locally
	let brief = $state(wod?.description ?? '');
	// svelte-ignore state_referenced_locally
	let drafts = $state<SectionDraft[]>(toDrafts(wod));

	let view = $state<'edit' | 'preview'>('edit');
	let saving = $state(false);
	let showErrors = $state(false);
	let removed = $state<{ draft: SectionDraft; index: number } | null>(null);

	const snapshot = () => JSON.stringify({ date, brief: brief.trim(), drafts });
	let saved = $state(snapshot());
	const dirty = $derived(snapshot() !== saved);

	// --- Validation -----------------------------------------------------------

	const dateError = $derived(!isIsoDate(date) ? t.editor.errors.pickDate : '');
	const briefError = $derived(brief.length > 500 ? t.editor.errors.briefTooLong : '');
	const sectionsError = $derived(drafts.length === 0 ? t.editor.errors.noSections : '');
	const draftsValid = $derived(
		drafts.every((d) => d.name.trim() && d.name.length <= 100 && d.content.length <= 2000)
	);
	const valid = $derived(!dateError && !briefError && !sectionsError && draftsValid);

	const sameDay = $derived(
		isIsoDate(date) ? wodStore.onDate(date).filter((other) => other.id !== wod?.id) : []
	);

	// --- Preview --------------------------------------------------------------

	const preview = $derived<WoD>({
		id: wod?.id ?? 'preview',
		workspaceId,
		date: isIsoDate(date) ? date : today,
		description: brief.trim() || null,
		sections: drafts.map((d, order) => ({
			id: d.key,
			wodId: wod?.id ?? 'preview',
			type: d.type,
			name: d.name.trim() || sectionTypes[d.type].label,
			content: d.content,
			order,
			timerConfig: d.timer ? serializeTimerConfig(d.timer) : null
		})),
		createdAt: wod?.createdAt ?? new Date(),
		updatedAt: new Date()
	});
	const previewMain = $derived(mainSection(preview));

	// --- Sections -------------------------------------------------------------

	function nextType(): SectionType {
		const used = new Set(drafts.map((d) => d.type));
		if (drafts.length === 0) return 'warmup';
		if (!used.has('wod')) return 'wod';
		if (!used.has('cooldown')) return 'cooldown';
		return 'custom';
	}

	async function addSection(type: SectionType = nextType()) {
		const draft: SectionDraft = {
			key: generateId(),
			type,
			name: sectionTypes[type].label,
			content: '',
			timer: null
		};
		drafts.push(draft);
		removed = null;
		view = 'edit';
		await tick();
		const input = document.getElementById(`section-name-${draft.key}`) as HTMLInputElement | null;
		input?.focus();
		input?.select();
		input?.scrollIntoView({ block: 'center', behavior: 'auto' });
	}

	async function move(index: number, by: -1 | 1) {
		const target = index + by;
		if (target < 0 || target >= drafts.length) return;
		const focused = document.activeElement?.id;
		const [draft] = drafts.splice(index, 1);
		drafts.splice(target, 0, draft);
		await tick();
		if (focused) document.getElementById(focused)?.focus();
	}

	function remove(index: number) {
		const [draft] = drafts.splice(index, 1);
		removed = { draft, index };
	}

	function undoRemove() {
		if (!removed) return;
		drafts.splice(Math.min(removed.index, drafts.length), 0, removed.draft);
		removed = null;
	}

	// --- Magic Wand -----------------------------------------------------------

	type WandState =
		| { kind: 'idle' }
		| { kind: 'working' }
		| { kind: 'off' }
		| { kind: 'error'; message: string }
		| { kind: 'drafted'; count: number; before: SectionDraft[] };

	let wand = $state<WandState>({ kind: 'idle' });
	const briefReady = $derived(brief.trim().length >= 5);
	let wandNote = $state<HTMLElement>();

	// Whatever the Wand has to say must be on screen, not below the fold of a phone.
	$effect(() => {
		if (wand.kind === 'idle' || wand.kind === 'working') return;
		wandNote?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
	});

	async function runWand() {
		if (!briefReady || wand.kind === 'working') return;
		if (!aiEnabled) {
			wand = { kind: 'off' };
			return;
		}
		if (syncStore.isOffline) {
			wand = { kind: 'error', message: t.editor.wand.offline };
			return;
		}

		wand = { kind: 'working' };
		try {
			const response = await fetch('/api/wods/generate-sections', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ description: brief.trim() })
			});
			const body = await response.json().catch(() => ({}));

			if (!response.ok) {
				if (body?.code === 'ai_not_configured') wand = { kind: 'off' };
				else
					wand = {
						kind: 'error',
						message: typeof body?.error === 'string' ? body.error : t.editor.wand.failed
					};
				return;
			}

			const generated: SectionDraft[] = (body.sections ?? [])
				.filter((s: { type: string }) => (SECTION_TYPES as readonly string[]).includes(s.type))
				.map(
					(s: {
						type: SectionType;
						name: string;
						content: string;
						timerConfig: string | null;
					}) => ({
						key: generateId(),
						type: s.type,
						name: s.name,
						content: s.content,
						timer: parseTimerConfig(s.timerConfig)
					})
				);
			if (generated.length === 0) {
				wand = { kind: 'error', message: t.editor.wand.empty };
				return;
			}

			// The draft replaces what is there, and one tap brings the old sections back.
			const before = $state.snapshot(drafts) as SectionDraft[];
			drafts = generated;
			removed = null;
			wand = { kind: 'drafted', count: generated.length, before };
		} catch {
			wand = { kind: 'error', message: t.editor.wand.unreachable };
		}
	}

	function undoWand() {
		if (wand.kind !== 'drafted') return;
		drafts = wand.before;
		wand = { kind: 'idle' };
	}

	// --- Save / leave ---------------------------------------------------------

	let leaveOpen = $state(false);
	let leaveTo = $state<URL | null>(null);
	let leaving = false;

	async function save() {
		if (saving) return;
		if (!valid) {
			showErrors = true;
			view = 'edit';
			await tick();
			const firstInvalid = document.querySelector<HTMLElement>(
				'.editor [aria-invalid="true"], .editor [data-error="true"]'
			);
			firstInvalid?.scrollIntoView({ block: 'center', behavior: 'auto' });
			firstInvalid?.focus?.();
			toastStore.error(
				sectionsError || dateError || briefError || t.editor.errors.sectionsNeedName
			);
			return;
		}

		saving = true;
		const payload = {
			date,
			description: brief.trim() || null,
			sections: drafts.map((d, order) => ({
				id: d.key,
				type: d.type,
				name: d.name.trim(),
				content: d.content.trim(),
				order,
				timerConfig: d.timer ? serializeTimerConfig(d.timer) : null
			}))
		};

		try {
			if (wod) await wodStore.update(wod.id, payload);
			else await wodStore.create({ workspaceId, ...payload });

			saved = snapshot();
			toastStore.success(
				syncStore.isOffline
					? t.editor.toast.savedOffline
					: wod
						? t.editor.toast.updated
						: t.editor.toast.savedFor(formatLong(date))
			);
			leaving = true;
			await goto(resolve('/workouts'));
		} catch (error) {
			console.error('Failed to save WoD:', error);
			toastStore.error(t.editor.toast.saveFailed);
			saving = false;
		}
	}

	beforeNavigate((navigation) => {
		if (!dirty || leaving || saving) return;
		if (navigation.type === 'leave') return; // the browser asks (see beforeunload below)
		navigation.cancel();
		leaveTo = navigation.to?.url ?? null;
		leaveOpen = true;
	});

	function discardAndLeave() {
		leaving = true;
		leaveOpen = false;
		// `leaveTo` is the URL SvelteKit was already navigating to, so it needs no resolving.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(leaveTo ? leaveTo.pathname + leaveTo.search : resolve('/workouts'));
	}

	function onBeforeUnload(event: BeforeUnloadEvent) {
		if (dirty && !saving && !leaving) event.preventDefault();
	}

	function onKeydown(event: KeyboardEvent) {
		const command = event.metaKey || event.ctrlKey;
		if (command && event.key.toLowerCase() === 's') {
			event.preventDefault();
			void save();
		} else if (command && event.key === 'Enter') {
			event.preventDefault();
			void addSection();
		}
	}

	const quickDates = $derived([
		{ key: 'today', label: t.editor.today, value: today },
		{ key: 'tomorrow', label: t.editor.tomorrow, value: addDays(today, 1) }
	]);
</script>

<svelte:window onkeydown={onKeydown} onbeforeunload={onBeforeUnload} />

<div class="editor">
	<header class="bar">
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built with resolve() above -->
		<a href={backHref} class="icon-btn flex-none" aria-label={t.editor.back}>
			<Icon name="arrow-left" size={22} stroke={2.8} />
		</a>
		<div class="min-w-0 flex-1">
			<h1 class="truncate display text-[2rem] lg:text-[2.5rem]">
				{isNew ? t.editor.newWod : t.editor.editWod}
			</h1>
			<p class="mt-0.5 truncate legend {dirty ? 'text-warn-ink' : 'text-mute'}">
				{#if saving}{t.editor.status.saving}{:else if dirty}{t.editor.status
						.unsaved}{:else if isNew}{t.editor.status.blank}{:else}{t.editor.status.saved}{/if}
			</p>
		</div>
		<button type="button" class="btn btn-pink flex-none" disabled={saving} onclick={save}>
			<Icon name="check" size={20} stroke={3.4} />
			{isNew ? t.editor.saveWodShort : t.editor.save}
			<kbd class="hidden border border-current px-1.5 py-0.5 legend lg:inline">⌘S</kbd>
		</button>
	</header>

	<!-- Phone: switch between the bench and the board -->
	<div class="switch" role="tablist" aria-label={t.editor.viewSwitch}>
		<button
			type="button"
			role="tab"
			aria-selected={view === 'edit'}
			class:on={view === 'edit'}
			onclick={() => (view = 'edit')}
		>
			{t.editor.tabEdit}
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={view === 'preview'}
			class:on={view === 'preview'}
			onclick={() => (view = 'preview')}
		>
			{t.editor.tabPreview}
		</button>
	</div>

	<div class="cols">
		<form
			class="bench"
			class:hidden-phone={view !== 'edit'}
			novalidate
			onsubmit={(event) => {
				event.preventDefault();
				void save();
			}}
		>
			<!-- Date -->
			<div class="module pb-5">
				<div class="module-head">
					<span>{t.editor.when}</span><span>{isIsoDate(date) ? formatLong(date) : ''}</span>
				</div>
				<label for="wod-date" class="sr-only">{t.editor.date}</label>
				<div class="flex flex-wrap items-center gap-2">
					<input
						id="wod-date"
						type="date"
						class="input w-auto min-w-[12rem] flex-1 sm:flex-none"
						bind:value={date}
						required
						aria-invalid={showErrors && !!dateError}
					/>
					{#each quickDates as option (option.key)}
						<button
							type="button"
							class="tag min-h-11 px-3 {date === option.value ? 'tag-ink' : ''}"
							aria-pressed={date === option.value}
							onclick={() => (date = option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
				{#if showErrors && dateError}
					<p class="mt-1.5 text-base font-semibold text-danger-ink">{dateError}</p>
				{/if}
				{#if sameDay.length > 0}
					<p class="notice notice-warn mt-3">
						{t.editor.sameDay(
							formatLong(date),
							sameDay.map((w) => wodTitle(w))
						)}
					</p>
				{/if}
			</div>

			<!-- Brief + Magic Wand -->
			<div class="module pb-5">
				<div class="module-head">
					<label for="wod-brief">{t.editor.brief.label}</label>
					<span class={brief.length > 500 ? 'text-danger-ink' : ''}>{brief.length}/500</span>
				</div>
				<textarea
					id="wod-brief"
					class="input"
					rows="3"
					placeholder={t.editor.brief.placeholder}
					bind:value={brief}
					aria-invalid={!!briefError}
					aria-describedby="wod-brief-help"
				></textarea>
				{#if briefError}
					<p class="mt-1.5 text-base font-semibold text-danger-ink">{briefError}</p>
				{/if}

				<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
					<button
						type="button"
						class="btn btn-ink"
						onclick={runWand}
						disabled={!briefReady || wand.kind === 'working'}
						aria-describedby="wod-brief-help"
					>
						<Icon name="wand" size={20} stroke={2.6} />
						{wand.kind === 'working' ? t.editor.wand.drafting : t.editor.wand.button}
					</button>
					<p id="wod-brief-help" class="min-w-0 flex-1 basis-48 text-base leading-snug text-mute">
						{#if !briefReady}
							{t.editor.wand.helpEmpty}
						{:else}
							{t.editor.wand.helpReady}
						{/if}
					</p>
				</div>

				<div bind:this={wandNote} class="scroll-mb-28">
					{#if wand.kind === 'working'}
						<div class="led mt-3 h-3" role="status" aria-label={t.editor.wand.draftingAria}></div>
					{:else if wand.kind === 'off'}
						<div class="notice notice-warn mt-3" role="status">
							<span class="mt-0.5 flex-none text-warn-ink"
								><Icon name="info" size={20} stroke={2.6} /></span
							>
							<p>{t.editor.wand.off}</p>
						</div>
					{:else if wand.kind === 'error'}
						<div class="notice notice-danger mt-3" role="alert">
							<span class="mt-0.5 flex-none text-danger-ink"
								><Icon name="alert" size={20} stroke={2.6} /></span
							>
							<p>{wand.message}</p>
						</div>
					{:else if wand.kind === 'drafted'}
						<div class="notice notice-pink mt-3 items-center" role="status">
							<p class="min-w-0 flex-1">
								{t.editor.wand.drafted(wand.count)}
							</p>
							<button type="button" class="btn btn-sm btn-quiet flex-none" onclick={undoWand}>
								<Icon name="undo" size={16} stroke={2.8} />
								{t.editor.wand.undo}
							</button>
						</div>
					{/if}
				</div>
			</div>

			<!-- Sections -->
			<div class="module-head border-t-2 border-ink">
				<span>{t.editor.sections.heading}</span>
				<span>{t.editor.sections.parts(drafts.length)}</span>
			</div>

			{#each drafts as draft, index (draft.key)}
				<SectionEditor
					bind:draft={drafts[index]}
					{index}
					count={drafts.length}
					{showErrors}
					onmove={(by) => move(index, by)}
					onremove={() => remove(index)}
				/>
			{/each}

			{#if removed}
				<div class="notice mb-4 items-center" role="status">
					<p class="min-w-0 flex-1">
						{t.editor.sections.removed(removed.draft.name || t.editor.sections.section)}
					</p>
					<button type="button" class="btn btn-sm btn-quiet flex-none" onclick={undoRemove}>
						<Icon name="undo" size={16} stroke={2.8} />
						{t.editor.sections.undo}
					</button>
				</div>
			{/if}

			<div
				class="add"
				data-error={showErrors && !!sectionsError}
				class:invalid={showErrors && !!sectionsError}
			>
				{#if drafts.length === 0}
					<p
						class="mb-3 text-lg leading-snug {showErrors
							? 'font-semibold text-danger-ink'
							: 'text-dim'}"
					>
						{showErrors ? sectionsError : t.editor.sections.empty}
					</p>
				{/if}
				<div class="flex flex-wrap items-center gap-2">
					<button type="button" class="btn" onclick={() => addSection()}>
						<Icon name="plus" size={20} stroke={3.4} />
						{t.editor.sections.add}
					</button>
					<span class="hidden legend text-mute lg:inline">{t.editor.sections.or}</span>
					{#each SECTION_TYPES as type (type)}
						<button
							type="button"
							class="tag min-h-11 px-3"
							onclick={() => addSection(type)}
							aria-label={t.editor.sections.addTypeAria(sectionTypes[type].label)}
						>
							+ {sectionTypes[type].label}
						</button>
					{/each}
				</div>
			</div>

			<div class="mt-8 flex flex-col gap-2 border-t border-line pt-5 sm:flex-row-reverse">
				<button type="submit" class="btn btn-pink btn-slab sm:flex-1" disabled={saving}>
					{saving ? t.editor.saving : isNew ? t.editor.saveWod : t.editor.saveChanges}
				</button>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built with resolve() above -->
				<a href={backHref} class="btn btn-quiet sm:min-h-[4.5rem] sm:px-8">{t.editor.cancel}</a>
			</div>

			<p class="mt-5 hidden legend text-mute lg:block">
				{t.editor.sections.shortcuts}
			</p>
		</form>

		<aside class="board" class:hidden-phone={view !== 'preview'} aria-label={t.editor.preview.aria}>
			<div class="module-head border-t-2 border-ink">
				<span>{t.editor.preview.heading}</span>
				<span>{t.editor.preview.live}</span>
			</div>
			<div class="frame">
				{#if drafts.length === 0 && !brief.trim()}
					<p class="py-10 text-center text-lg text-mute">{t.editor.preview.empty}</p>
				{:else}
					<Poster wod={preview} />
					<div class="mt-6">
						{#each preview.sections as section, index (section.id)}
							<SectionBlock
								{section}
								index={index + 1}
								main={section.id === previewMain?.id}
								preview
							/>
						{/each}
					</div>
				{/if}
			</div>
		</aside>
	</div>
</div>

<ConfirmDialog
	bind:open={leaveOpen}
	title={t.editor.leave.title}
	message={t.editor.leave.message}
	confirmLabel={t.editor.leave.confirm}
	cancelLabel={t.editor.leave.cancel}
	danger
	onconfirm={discardAndLeave}
/>

<style>
	.editor {
		max-width: 84rem;
	}
	.bar {
		position: sticky;
		top: calc(var(--bar-h) + var(--safe-top));
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem calc(1rem + var(--safe-right)) 0.625rem calc(1rem + var(--safe-left));
		background: var(--c-bg);
		border-bottom: 2px solid var(--c-ink);
	}
	.switch {
		display: grid;
		grid-template-columns: 1fr 1fr;
		border-bottom: 1px solid var(--c-line-strong);
	}
	.switch button {
		min-height: 3rem;
		font-family: var(--font-mono);
		font-stretch: 75%;
		font-weight: 700;
		font-size: 0.8125rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--c-mute);
	}
	.switch button.on {
		color: var(--c-bg);
		background: var(--c-ink);
	}
	.cols {
		padding: 1.25rem calc(1rem + var(--safe-right)) 0 calc(1rem + var(--safe-left));
	}
	.bench,
	.board {
		min-width: 0;
	}
	.hidden-phone {
		display: none;
	}
	.add {
		padding: 1rem 0 0;
		border-top: 2px solid var(--c-ink);
	}
	.add.invalid {
		border-top-color: var(--c-danger);
	}
	.frame {
		container-type: inline-size;
	}
	@media (min-width: 1024px) {
		.bar {
			top: 0;
			padding: 1rem 2.5rem;
		}
		.switch {
			display: none;
		}
		.cols {
			display: grid;
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
			gap: 3rem;
			align-items: start;
			padding: 1.75rem 2.5rem 0;
		}
		.hidden-phone {
			display: block;
		}
		.board {
			position: sticky;
			top: 6.5rem;
			max-height: calc(100dvh - 8rem);
			overflow-y: auto;
			padding-right: 0.25rem;
		}
		.frame {
			max-width: 26rem;
			padding: 1rem;
			border: 1px solid var(--c-line-strong);
			background: var(--c-bg);
		}
	}
</style>
