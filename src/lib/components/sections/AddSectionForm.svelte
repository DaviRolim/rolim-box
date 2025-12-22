<script lang="ts">
	import { sectionTypes } from '$lib/config/section-types';
	import type { SectionType } from '$lib/types/wod';

	interface Props {
		onAdd: (section: { type: SectionType; name: string; content: string }) => void;
		onCancel?: () => void;
	}

	let { onAdd, onCancel }: Props = $props();

	let selectedType = $state<SectionType>('warmup');
	let name = $state('');
	let content = $state('');
	let nameError = $state('');
	let contentError = $state('');

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

		onAdd({
			type: selectedType,
			name: name.trim(),
			content: content.trim()
		});

		// Reset form
		selectedType = 'warmup';
		name = '';
		content = '';
	}

	function handleCancel() {
		if (onCancel) {
			onCancel();
		}
	}
</script>

<div class="add-section-form">
	<!-- Kinetic accent -->
	<div class="form-accent"></div>

	<div class="form-header">
		<h3 class="form-title">Add Section</h3>
	</div>

	<div class="form-body">
		<!-- Type selector -->
		<div class="form-group">
			<label class="form-label" for="section-type">Section Type</label>
			<div class="type-selector" role="group" aria-label="Section type">
				{#each Object.entries(sectionTypes) as [type, config]}
					<button
						type="button"
						class="type-button"
						class:active={selectedType === type}
						data-color={config.color}
						onclick={() => handleTypeSelect(type as SectionType)}
						aria-pressed={selectedType === type}
					>
						<span class="type-icon" role="img" aria-label={config.label}>{config.icon}</span>
						<span class="type-label">{config.label}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Name input -->
		<div class="form-group">
			<label class="form-label" for="section-name">
				Name
				<span class="form-hint">{name.length}/100</span>
			</label>
			<input
				id="section-name"
				type="text"
				class="form-input"
				class:error={nameError}
				bind:value={name}
				placeholder="e.g., Morning Warmup"
				maxlength="100"
				aria-invalid={!!nameError}
				aria-describedby={nameError ? 'name-error' : undefined}
			/>
			{#if nameError}
				<p id="name-error" class="form-error" role="alert">{nameError}</p>
			{/if}
		</div>

		<!-- Content textarea -->
		<div class="form-group">
			<label class="form-label" for="section-content">
				Content
				<span class="form-hint">{content.length}/2000</span>
			</label>
			<textarea
				id="section-content"
				class="form-textarea"
				class:error={contentError}
				bind:value={content}
				placeholder="Describe the workout section...&#10;&#10;Example:&#10;400m run&#10;20 air squats&#10;10 push-ups"
				maxlength="2000"
				rows="8"
				aria-invalid={!!contentError}
				aria-describedby={contentError ? 'content-error' : undefined}
			></textarea>
			{#if contentError}
				<p id="content-error" class="form-error" role="alert">{contentError}</p>
			{/if}
		</div>
	</div>

	<div class="form-actions">
		{#if onCancel}
			<button type="button" class="btn-cancel" onclick={handleCancel}>Cancel</button>
		{/if}
		<button type="button" class="btn-add" onclick={handleSubmit}>
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
				<path d="M8 3V13M3 8H13" stroke-width="2" stroke-linecap="square" />
			</svg>
			Add Section
		</button>
	</div>
</div>

<style>
	.add-section-form {
		background: #1a1a1a;
		border: 2px solid #2a2a2a;
		position: relative;
		overflow: hidden;
	}

	.form-accent {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		background: linear-gradient(90deg, #6e489f 0%, #e91e8c 100%);
		animation: accentPulse 2s ease-in-out infinite;
	}

	@keyframes accentPulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.8;
		}
	}

	.form-header {
		padding: 24px 24px 16px 24px;
		border-bottom: 1px solid #2a2a2a;
	}

	.form-title {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 20px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: -0.01em;
		color: #ffffff;
		margin: 0;
	}

	.form-body {
		padding: 24px;
	}

	.form-group {
		margin-bottom: 24px;
	}

	.form-group:last-child {
		margin-bottom: 0;
	}

	.form-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #ffffff;
		margin-bottom: 12px;
	}

	.form-hint {
		font-size: 11px;
		font-weight: 600;
		color: #525252;
	}

	.type-selector {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.type-button {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 16px 12px;
		background: transparent;
		border: 2px solid #2a2a2a;
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		min-height: 88px;
	}

	.type-button:hover {
		background: rgba(255, 255, 255, 0.05);
		border-color: #3a3a3a;
		transform: translateY(-2px);
	}

	.type-button:active {
		transform: translateY(0);
	}

	.type-button.active {
		border-width: 2px;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.type-button.active[data-color='orange'] {
		border-color: #f97316;
		background: rgba(249, 115, 22, 0.1);
	}

	.type-button.active[data-color='blue'] {
		border-color: #3b82f6;
		background: rgba(59, 130, 246, 0.1);
	}

	.type-button.active[data-color='pink'] {
		border-color: #e91e8c;
		background: rgba(233, 30, 140, 0.1);
	}

	.type-button.active[data-color='cyan'] {
		border-color: #06b6d4;
		background: rgba(6, 182, 212, 0.1);
	}

	.type-button.active[data-color='purple'] {
		border-color: #6e489f;
		background: rgba(110, 72, 159, 0.1);
	}

	.type-button.active[data-color='gray'] {
		border-color: #737373;
		background: rgba(115, 115, 115, 0.1);
	}

	.type-button:focus-visible {
		outline: 2px solid #6e489f;
		outline-offset: 2px;
	}

	.type-icon {
		font-size: 28px;
		line-height: 1;
	}

	.type-label {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #a3a3a3;
	}

	.type-button.active .type-label {
		color: #ffffff;
	}

	.form-input,
	.form-textarea {
		width: 100%;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 400;
		padding: 14px 16px;
		background: #0a0a0a;
		border: 2px solid #2a2a2a;
		color: #ffffff;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.form-input:focus,
	.form-textarea:focus {
		outline: none;
		border-color: #6e489f;
		box-shadow: 0 0 0 3px rgba(110, 72, 159, 0.15);
	}

	.form-input.error,
	.form-textarea.error {
		border-color: #ef4444;
	}

	.form-input::placeholder,
	.form-textarea::placeholder {
		color: #525252;
	}

	.form-textarea {
		resize: vertical;
		min-height: 120px;
		line-height: 1.6;
		white-space: pre-wrap;
	}

	.form-error {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 12px;
		font-weight: 600;
		color: #ef4444;
		margin: 8px 0 0 0;
	}

	.form-actions {
		display: flex;
		gap: 12px;
		padding: 20px 24px 24px 24px;
		background: #0a0a0a;
		border-top: 1px solid #2a2a2a;
	}

	.btn-cancel,
	.btn-add {
		flex: 1;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 16px 24px;
		border: 2px solid;
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		min-height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
	}

	.btn-cancel {
		background: transparent;
		border-color: #2a2a2a;
		color: #a3a3a3;
	}

	.btn-cancel:hover {
		background: #2a2a2a;
		border-color: #3a3a3a;
		color: #ffffff;
		transform: translateY(-1px);
	}

	.btn-add {
		background: linear-gradient(135deg, #6e489f 0%, #5c3a87 100%);
		border-color: #6e489f;
		color: #ffffff;
		box-shadow: 0 4px 12px rgba(110, 72, 159, 0.3);
	}

	.btn-add:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(110, 72, 159, 0.4);
	}

	.btn-cancel:active,
	.btn-add:active {
		transform: translateY(0);
	}

	.btn-cancel:focus-visible,
	.btn-add:focus-visible {
		outline: 2px solid #6e489f;
		outline-offset: 2px;
	}

	/* Mobile optimization */
	@media (max-width: 640px) {
		.form-header {
			padding: 20px 20px 12px 20px;
		}

		.form-title {
			font-size: 18px;
		}

		.form-body {
			padding: 20px;
		}

		.type-selector {
			grid-template-columns: repeat(2, 1fr);
		}

		.form-actions {
			flex-direction: column;
			padding: 16px 20px 20px 20px;
		}

		.btn-cancel,
		.btn-add {
			width: 100%;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.form-accent,
		.type-button,
		.btn-cancel,
		.btn-add {
			animation: none;
			transition: none;
		}

		.type-button:hover,
		.type-button.active,
		.btn-cancel:hover,
		.btn-add:hover {
			transform: none;
		}
	}
</style>
