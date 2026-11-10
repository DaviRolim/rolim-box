<script lang="ts">
	import { toastStore } from '$lib/stores/toast.svelte';
	import Icon from './Icon.svelte';
	import { t } from '$lib/i18n';

	const ICON = { success: 'check', error: 'alert', info: 'info' } as const;
</script>

<!-- Messages stack above the bottom navigation, where they never cover the WoD's name. -->
<div class="toasts" aria-live="polite">
	{#each toastStore.toasts as toast (toast.id)}
		<div class="toast toast-{toast.type}" role={toast.type === 'error' ? 'alert' : 'status'}>
			<span class="mark"><Icon name={ICON[toast.type]} size={20} stroke={3} /></span>
			<p class="min-w-0 flex-1 py-3 text-base leading-snug font-semibold">{toast.message}</p>
			<button
				type="button"
				class="dismiss"
				onclick={() => toastStore.dismiss(toast.id)}
				aria-label={t.common.dismiss}
			>
				<Icon name="x" size={18} stroke={2.5} />
			</button>
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		z-index: 90;
		left: calc(0.75rem + var(--safe-left));
		right: calc(0.75rem + var(--safe-right));
		bottom: calc(var(--nav-h) + var(--safe-bottom) + 0.75rem);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		pointer-events: none;
	}
	.toast {
		display: flex;
		align-items: stretch;
		gap: 0.75rem;
		pointer-events: auto;
		background: var(--c-ink);
		color: var(--c-bg);
		border-radius: 2px;
		animation: var(--animate-lift);
	}
	.mark {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		flex: none;
		color: var(--c-on-fill);
		background: var(--c-ok);
	}
	.toast-error .mark {
		background: var(--c-danger);
	}
	.toast-info .mark {
		background: var(--c-pink);
	}
	.dismiss {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		flex: none;
		color: inherit;
		opacity: 0.7;
	}
	@media (min-width: 1024px) {
		.toasts {
			left: auto;
			right: 1.5rem;
			bottom: 1.5rem;
			width: 24rem;
		}
	}
</style>
