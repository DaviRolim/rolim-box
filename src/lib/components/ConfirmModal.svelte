<script lang="ts">
	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmText?: string;
		cancelText?: string;
		onConfirm: () => void;
		onCancel: () => void;
		variant?: 'danger' | 'warning' | 'default';
	}

	let {
		open = $bindable(false),
		title,
		message,
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		onConfirm,
		onCancel,
		variant = 'default'
	}: Props = $props();

	let dialogElement: HTMLDialogElement;
	let previouslyFocused: HTMLElement | null = null;

	$effect(() => {
		if (!dialogElement) return;

		if (open) {
			previouslyFocused = document.activeElement as HTMLElement;
			dialogElement.showModal();
			// Focus the cancel button by default (safer)
			const cancelBtn = dialogElement.querySelector('[data-cancel]') as HTMLButtonElement;
			cancelBtn?.focus();
		} else {
			dialogElement.close();
			previouslyFocused?.focus();
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			handleCancel();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialogElement) {
			handleCancel();
		}
	}

	function handleConfirm() {
		open = false;
		onConfirm();
	}

	function handleCancel() {
		open = false;
		onCancel();
	}

	// Trap focus within modal
	function handleFocusTrap(e: KeyboardEvent) {
		if (e.key !== 'Tab' || !open) return;

		const focusableElements = dialogElement.querySelectorAll(
			'button:not(:disabled), [href]:not([disabled]), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"]):not(:disabled)'
		);
		const visibleElements = Array.from(focusableElements).filter(el => {
			const element = el as HTMLElement;
			return element.offsetParent !== null;
		});
		const firstElement = visibleElements[0] as HTMLElement;
		const lastElement = visibleElements[visibleElements.length - 1] as HTMLElement;

		if (e.shiftKey && document.activeElement === firstElement) {
			e.preventDefault();
			lastElement.focus();
		} else if (!e.shiftKey && document.activeElement === lastElement) {
			e.preventDefault();
			firstElement.focus();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialogElement}
	onkeydown={(e) => {
		handleKeydown(e);
		handleFocusTrap(e);
	}}
	onclick={handleBackdropClick}
	class="confirm-modal"
	aria-labelledby="modal-title"
	aria-describedby="modal-message"
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-content" onclick={(e) => e.stopPropagation()}>
		<!-- Kinetic accent line -->
		<div class="modal-accent" data-variant={variant}></div>

		<div class="modal-header">
			<h2 id="modal-title" class="modal-title">{title}</h2>
		</div>

		<div class="modal-body">
			<p id="modal-message" class="modal-message">{message}</p>
		</div>

		<div class="modal-actions">
			<button
				type="button"
				class="btn-cancel"
				onclick={handleCancel}
				data-cancel
				aria-label="Cancel action"
			>
				{cancelText}
			</button>
			<button
				type="button"
				class="btn-confirm"
				data-variant={variant}
				onclick={handleConfirm}
				aria-label="Confirm action"
			>
				{confirmText}
			</button>
		</div>
	</div>
</dialog>

<style>
	.confirm-modal {
		border: none;
		background: transparent;
		padding: 0;
		max-width: 90vw;
		width: 440px;
		outline: none;
	}

	.confirm-modal::backdrop {
		background: rgba(10, 10, 10, 0.85);
		backdrop-filter: blur(8px);
		animation: fadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.modal-content {
		background: #1a1a1a;
		border: 2px solid #2a2a2a;
		position: relative;
		overflow: hidden;
		animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Kinetic accent - bold geometric bar */
	.modal-accent {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 6px;
		background: linear-gradient(90deg, #6e489f 0%, #e91e8c 100%);
		animation: accentPulse 2s ease-in-out infinite;
	}

	.modal-accent[data-variant='danger'] {
		background: linear-gradient(90deg, #dc2626 0%, #ef4444 100%);
	}

	.modal-accent[data-variant='warning'] {
		background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
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

	.modal-header {
		padding: 32px 24px 16px 24px;
	}

	.modal-title {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 24px;
		font-weight: 800;
		letter-spacing: -0.02em;
		text-transform: uppercase;
		color: #ffffff;
		margin: 0;
	}

	.modal-body {
		padding: 0 24px 24px 24px;
	}

	.modal-message {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 15px;
		font-weight: 400;
		line-height: 1.6;
		color: #a3a3a3;
		margin: 0;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		padding: 20px 24px 24px 24px;
		background: #0a0a0a;
		border-top: 1px solid #2a2a2a;
	}

	/* Brutalist button styles */
	.btn-cancel,
	.btn-confirm {
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
		position: relative;
		overflow: hidden;
		min-height: 48px;
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

	.btn-cancel:active {
		transform: translateY(0);
	}

	.btn-cancel:focus-visible {
		outline: 2px solid #6e489f;
		outline-offset: 2px;
	}

	.btn-confirm {
		background: linear-gradient(135deg, #6e489f 0%, #5c3a87 100%);
		border-color: #6e489f;
		color: #ffffff;
		box-shadow: 0 4px 12px rgba(110, 72, 159, 0.3);
	}

	.btn-confirm[data-variant='danger'] {
		background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
		border-color: #dc2626;
		box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
	}

	.btn-confirm[data-variant='warning'] {
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		border-color: #f59e0b;
		box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
	}

	.btn-confirm:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(110, 72, 159, 0.4);
	}

	.btn-confirm[data-variant='danger']:hover {
		box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4);
	}

	.btn-confirm[data-variant='warning']:hover {
		box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
	}

	.btn-confirm:active {
		transform: translateY(0);
	}

	.btn-confirm:focus-visible {
		outline: 2px solid #e91e8c;
		outline-offset: 2px;
	}

	/* Mobile optimization */
	@media (max-width: 480px) {
		.confirm-modal {
			width: calc(100vw - 32px);
			max-width: none;
		}

		.modal-title {
			font-size: 20px;
		}

		.modal-message {
			font-size: 14px;
		}

		.modal-actions {
			flex-direction: column;
		}

		.btn-cancel,
		.btn-confirm {
			width: 100%;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.confirm-modal::backdrop,
		.modal-content,
		.modal-accent {
			animation: none;
		}

		.btn-cancel,
		.btn-confirm {
			transition: none;
		}
	}
</style>
