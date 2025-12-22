<script lang="ts">
	import { toastStore, type Toast } from '$lib/stores/toast.svelte';

	const toasts = $derived(toastStore.toasts);

	function getIcon(type: Toast['type']): string {
		switch (type) {
			case 'success':
				return '✓';
			case 'error':
				return '✕';
			case 'info':
				return 'i';
			default:
				return '•';
		}
	}

	function handleDismiss(id: string) {
		toastStore.dismiss(id);
	}
</script>

<div class="toast-container" role="region" aria-label="Notifications">
	{#each toasts as toast (toast.id)}
		<div
			class="toast"
			data-type={toast.type}
			role="alert"
			aria-live="polite"
			aria-atomic="true"
		>
			<div class="toast-icon" data-type={toast.type}>
				{getIcon(toast.type)}
			</div>

			<div class="toast-content">
				<p class="toast-message">{toast.message}</p>
			</div>

			<button
				type="button"
				class="toast-dismiss"
				onclick={() => handleDismiss(toast.id)}
				aria-label="Dismiss notification"
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
					<path d="M12 4L4 12M4 4L12 12" stroke-width="2" stroke-linecap="square" />
				</svg>
			</button>
		</div>
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		bottom: 24px;
		right: 24px;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 12px;
		pointer-events: none;
		max-width: calc(100vw - 48px);
	}

	@media (max-width: 640px) {
		.toast-container {
			bottom: 16px;
			right: 16px;
			left: 16px;
			max-width: none;
		}
	}

	.toast {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		background: #1a1a1a;
		border: 2px solid;
		padding: 16px 18px;
		min-width: 320px;
		max-width: 420px;
		pointer-events: auto;
		position: relative;
		overflow: hidden;
		animation: toastSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
	}

	@media (max-width: 640px) {
		.toast {
			min-width: 0;
			max-width: none;
			width: 100%;
		}
	}

	@keyframes toastSlideIn {
		from {
			opacity: 0;
			transform: translateX(100%) translateY(0);
		}
		to {
			opacity: 1;
			transform: translateX(0) translateY(0);
		}
	}

	/* Type-specific styles with kinetic accent bars */
	.toast[data-type='success'] {
		border-color: #10b981;
	}

	.toast[data-type='success']::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		background: linear-gradient(90deg, #10b981 0%, #059669 100%);
		animation: accentSlide 2s ease-in-out infinite;
	}

	.toast[data-type='error'] {
		border-color: #ef4444;
	}

	.toast[data-type='error']::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
		animation: accentPulse 1.5s ease-in-out infinite;
	}

	.toast[data-type='info'] {
		border-color: #f59e0b;
	}

	.toast[data-type='info']::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
		animation: accentSlide 2.5s ease-in-out infinite;
	}

	@keyframes accentSlide {
		0%,
		100% {
			transform: translateX(0%);
		}
		50% {
			transform: translateX(20%);
		}
	}

	@keyframes accentPulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}

	/* Icon styling - bold geometric shapes */
	.toast-icon {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 16px;
		font-weight: 900;
		border: 2px solid;
		position: relative;
		margin-top: 2px;
	}

	.toast-icon[data-type='success'] {
		background: rgba(16, 185, 129, 0.15);
		border-color: #10b981;
		color: #10b981;
	}

	.toast-icon[data-type='error'] {
		background: rgba(239, 68, 68, 0.15);
		border-color: #ef4444;
		color: #ef4444;
	}

	.toast-icon[data-type='info'] {
		background: rgba(245, 158, 11, 0.15);
		border-color: #f59e0b;
		color: #f59e0b;
	}

	.toast-content {
		flex: 1;
		min-width: 0;
	}

	.toast-message {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.5;
		color: #ffffff;
		margin: 0;
		word-wrap: break-word;
	}

	/* Dismiss button - brutalist X */
	.toast-dismiss {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid #2a2a2a;
		color: #737373;
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		padding: 0;
		margin-top: 2px;
	}

	.toast-dismiss:hover {
		background: #2a2a2a;
		border-color: #3a3a3a;
		color: #ffffff;
		transform: rotate(90deg);
	}

	.toast-dismiss:active {
		transform: rotate(90deg) scale(0.95);
	}

	.toast-dismiss:focus-visible {
		outline: 2px solid #6e489f;
		outline-offset: 2px;
	}

	/* Exit animation */
	@keyframes toastSlideOut {
		from {
			opacity: 1;
			transform: translateX(0) translateY(0);
		}
		to {
			opacity: 0;
			transform: translateX(120%) translateY(0);
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.toast,
		.toast::before,
		.toast-dismiss {
			animation: none !important;
			transition: none !important;
		}

		.toast-dismiss:hover {
			transform: none;
		}
	}
</style>
