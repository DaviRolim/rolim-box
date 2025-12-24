<script lang="ts">
	import { sectionTypes } from '$lib/config/section-types';
	import type { SectionType } from '$lib/types/wod';
	import TimerConfigComponent from '$lib/components/timer/TimerConfig.svelte';
	import { serializeTimerConfig, type TimerConfig } from '$lib/types/timer';
	import Button from '$lib/components/Button.svelte';

	interface Props {
		onAdd: (section: {
			type: SectionType;
			name: string;
			content: string;
			timerConfig: string | null;
		}) => void;
		onCancel?: () => void;
	}

	let { onAdd, onCancel }: Props = $props();

	let selectedType = $state<SectionType>('warmup');
	let name = $state('');
	let content = $state('');
	let nameError = $state('');
	let contentError = $state('');
	let showTimerConfig = $state(false);
	let timerConfigComponent: { getConfig: () => TimerConfig } | undefined = $state();

	// Auto-fill name when type changes
	$effect(() => {
		if (!name) {
			name = sectionTypes[selectedType].label;
		}
	});

	function handleTypeSelect(type: SectionType) {
		selectedType = type;
		// Only auto-update name if it matches the previous type's label
		const currentTypeName = sectionTypes[selectedType].label;
		if (!name || Object.values(sectionTypes).some((t) => t.label === name)) {
			name = currentTypeName;
		}
	}

	function validateForm(): boolean {
		nameError = '';
		contentError = '';

		if (!name.trim()) {
			nameError = 'Name is required';
			return false;
		}

		if (name.trim().length > 100) {
			nameError = 'Name must be 100 characters or less';
			return false;
		}

		if (!content.trim()) {
			contentError = 'Content is required';
			return false;
		}

		if (content.trim().length > 2000) {
			contentError = 'Content must be 2000 characters or less';
			return false;
		}

		return true;
	}

	function handleSubmit() {
		if (!validateForm()) return;

		let timerConfig: string | null = null;
		if (showTimerConfig && timerConfigComponent) {
			timerConfig = serializeTimerConfig(timerConfigComponent.getConfig());
		}

		onAdd({
			type: selectedType,
			name: name.trim(),
			content: content.trim(),
			timerConfig
		});

		// Reset form
		selectedType = 'warmup';
		name = '';
		content = '';
		showTimerConfig = false;
	}

	function toggleTimerConfig() {
		showTimerConfig = !showTimerConfig;
	}

	function removeTimerConfig() {
		showTimerConfig = false;
	}

	function handleCancel() {
		if (onCancel) {
			onCancel();
		}
	}
</script>

<div class="glass relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
	<!-- Top Accent -->
	<div class="h-1 bg-gradient-to-r from-accent-500 to-primary-500"></div>

	<div class="p-6">
		<h3 class="mb-6 text-xl font-black tracking-tight text-white uppercase">Add Section</h3>

		<div class="space-y-6">
			<!-- Type selector -->
			<div class="space-y-3">
				<span class="text-[10px] font-bold tracking-widest text-accent-400 uppercase"
					>Section Type</span
				>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{#each Object.entries(sectionTypes) as [type, config]}
						<button
							type="button"
							class="flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-all duration-300 {selectedType ===
							type
								? 'border-accent-500 bg-accent-500/10 shadow-lg shadow-accent-500/10'
								: 'border-white/5 bg-white/5 hover:bg-white/10'}"
							onclick={() => handleTypeSelect(type as SectionType)}
						>
							<span class="text-2xl">{config.icon}</span>
							<span
								class="text-[10px] font-bold tracking-wider uppercase {selectedType === type
									? 'text-white'
									: 'text-text-muted'}">{config.label}</span
							>
						</button>
					{/each}
				</div>
			</div>

			<!-- Name input -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<label
						class="text-[10px] font-bold tracking-widest text-accent-400 uppercase"
						for="section-name">Name</label
					>
					<span class="text-[10px] font-medium text-text-muted">{name.length}/100</span>
				</div>
				<input
					id="section-name"
					type="text"
					class="w-full rounded-xl border bg-white/5 p-4 text-white transition-all outline-none focus:border-accent-500/50 focus:bg-white/10 {nameError
						? 'border-error/50'
						: 'border-white/5'}"
					bind:value={name}
					placeholder="e.g., Morning Warmup"
					maxlength="100"
				/>
				{#if nameError}
					<p class="text-[10px] font-bold tracking-wider text-error uppercase">{nameError}</p>
				{/if}
			</div>

			<!-- Content textarea -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<label
						class="text-[10px] font-bold tracking-widest text-accent-400 uppercase"
						for="section-content">Content</label
					>
					<span class="text-[10px] font-medium text-text-muted">{content.length}/2000</span>
				</div>
				<textarea
					id="section-content"
					class="min-h-[160px] w-full rounded-xl border bg-white/5 p-4 font-sans text-white transition-all outline-none focus:border-accent-500/50 focus:bg-white/10 {contentError
						? 'border-error/50'
						: 'border-white/5'}"
					bind:value={content}
					placeholder="Describe the workout section..."
					maxlength="2000"
					rows="6"
				></textarea>
				{#if contentError}
					<p class="text-[10px] font-bold tracking-wider text-error uppercase">{contentError}</p>
				{/if}
			</div>

			<!-- Timer Configuration -->
			<div class="space-y-3 pt-2">
				{#if !showTimerConfig}
					<button
						type="button"
						class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 p-4 text-xs font-bold tracking-widest text-text-muted uppercase transition-all hover:border-accent-500/50 hover:bg-accent-500/5 hover:text-accent-400"
						onclick={toggleTimerConfig}
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="3"
						>
							<circle cx="12" cy="12" r="10" />
							<polyline points="12 6 12 12 16 14" />
						</svg>
						Add Timer Config
					</button>
				{:else}
					<div class="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
						<div class="flex items-center justify-between border-b border-white/5 pb-2">
							<div class="flex h-6 items-center gap-2 text-accent-500">
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="3"
								>
									<circle cx="12" cy="12" r="10" />
									<polyline points="12 6 12 12 16 14" />
								</svg>
								<span class="text-[10px] font-black tracking-widest uppercase">Timer Config</span>
							</div>
							<button
								type="button"
								class="rounded px-2 py-1 text-[10px] font-bold tracking-wider text-error uppercase hover:bg-error/10"
								onclick={removeTimerConfig}
							>
								Remove
							</button>
						</div>
						<TimerConfigComponent
							bind:this={timerConfigComponent}
							initialConfig={null}
							compact={true}
						/>
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-8 flex gap-3">
			{#if onCancel}
				<Button variant="secondary" class="flex-1" onclick={handleCancel}>CANCEL</Button>
			{/if}
			<Button variant="primary" class="flex-1" onclick={handleSubmit}>ADD SECTION</Button>
		</div>
	</div>
</div>
