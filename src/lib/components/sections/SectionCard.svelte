<script lang="ts">
	import { sectionTypes } from '$lib/config/section-types';
	import type { Section } from '$lib/types/wod';
	import { parseTimerConfig, TIMER_LABELS, formatTime } from '$lib/types/timer';

	interface Props {
		section: Section;
		editable?: boolean;
		canMoveUp?: boolean;
		canMoveDown?: boolean;
		onMoveUp?: () => void;
		onMoveDown?: () => void;
		onEdit?: () => void;
		onDelete?: () => void;
		expanded?: boolean;
	}

	let {
		section,
		editable = false,
		canMoveUp = false,
		canMoveDown = false,
		onMoveUp,
		onMoveDown,
		onEdit,
		onDelete,
		expanded = false
	}: Props = $props();

	const sectionConfig = $derived(sectionTypes[section.type]);
	const truncatedContent = $derived(
		section.content.length > 100 && !expanded
			? section.content.slice(0, 100) + '...'
			: section.content
	);
	const timerConfig = $derived(parseTimerConfig(section.timerConfig));
</script>

<div
	class="glass group relative overflow-hidden rounded-2xl border border-white/5 transition-all duration-300 hover:border-white/10 hover:shadow-2xl hover:shadow-black"
>
	<!-- Kinetic accent line -->
	<div
		class="absolute inset-x-0 top-0 h-1 opacity-80 transition-opacity group-hover:opacity-100"
		style="background: {sectionConfig.color === 'orange'
			? 'var(--color-accent-500)'
			: sectionConfig.color === 'blue'
				? 'var(--color-secondary-accent)'
				: sectionConfig.color === 'pink'
					? 'var(--color-accent-600)'
					: sectionConfig.color === 'cyan'
						? '#06b6d4'
						: sectionConfig.color === 'purple'
							? '#a855f7'
							: '#64748b'}"
	></div>

	<div class="flex flex-col gap-4 p-5">
		<div class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl"
				>
					{sectionConfig.icon}
				</div>
				<div>
					<span class="text-[10px] font-bold tracking-widest text-text-muted uppercase"
						>{sectionConfig.label}</span
					>
					<h3 class="text-lg leading-none font-black tracking-tight text-white uppercase">
						{section.name}
					</h3>
				</div>
			</div>

			{#if editable}
				<div class="flex items-center gap-1">
					<div class="mr-2 flex flex-col gap-0.5">
						<button
							type="button"
							class="p-1 text-text-muted transition-colors hover:text-white disabled:opacity-20"
							onclick={onMoveUp}
							disabled={!canMoveUp}
							title="Move up"
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="3"
							>
								<path d="M18 15l-6-6-6 6" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</button>
						<button
							type="button"
							class="p-1 text-text-muted transition-colors hover:text-white disabled:opacity-20"
							onclick={onMoveDown}
							disabled={!canMoveDown}
							title="Move down"
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="3"
							>
								<path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</button>
					</div>

					<button
						type="button"
						class="flex items-center gap-1.5 rounded-lg border border-white/5 bg-primary-800/50 px-3 py-1.5 text-[10px] font-bold tracking-wider text-white uppercase transition-colors hover:bg-primary-700"
						onclick={onEdit}
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
							<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
						</svg>
						EDIT
					</button>

					<button
						type="button"
						class="rounded-lg p-2 text-text-muted transition-colors hover:bg-error/5 hover:text-error"
						onclick={onDelete}
						title="Delete"
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path
								d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
							/>
						</svg>
					</button>
				</div>
			{/if}
		</div>

		<div class="relative">
			<pre
				class="rounded-xl border border-white/5 bg-black/20 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-text-secondary">{truncatedContent}</pre>
			{#if section.content.length > 100 && !expanded}
				<div
					class="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-bg-card/50 to-transparent"
				></div>
			{/if}
		</div>

		<div class="flex items-center justify-between pt-2">
			{#if timerConfig}
				<a
					href="/timers/{section.id}?wod={section.wodId}"
					class="flex items-center gap-2 rounded-full border border-accent-500/20 bg-accent-500/10 px-4 py-2 text-xs font-bold text-accent-400 shadow-lg shadow-accent-500/10 transition-all hover:bg-accent-500/20 active:scale-95"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
					>
						<circle cx="12" cy="12" r="10" />
						<polyline points="12 6 12 12 16 14" />
					</svg>
					<span class="tracking-wider uppercase">
						{TIMER_LABELS[timerConfig.type]}
						{#if timerConfig.type === 'amrap' || timerConfig.type === 'fortime'}
							• {formatTime(timerConfig.duration!)}
						{:else if timerConfig.type === 'emom'}
							• {timerConfig.rounds}x{timerConfig.intervalWork}s
						{:else if timerConfig.type === 'tabata'}
							• {timerConfig.rounds}x {timerConfig.intervalWork}s/{timerConfig.intervalRest}s
						{/if}
					</span>
				</a>
			{:else}
				<div
					class="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold tracking-wider text-text-muted uppercase"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
					</svg>
					NO TIMER
				</div>
			{/if}
		</div>
	</div>
</div>
