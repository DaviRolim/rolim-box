// Toast store using Svelte 5 runes
export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
	id: string;
	message: string;
	type: ToastType;
	duration: number;
	createdAt: number;
}

class ToastStore {
	toasts = $state<Toast[]>([]);
	private idCounter = 0;

	show(message: string, type: ToastType = 'info', duration: number = 4000): string {
		const id = `toast-${++this.idCounter}-${Date.now()}`;
		const toast: Toast = {
			id,
			message,
			type,
			duration,
			createdAt: Date.now()
		};

		this.toasts = [...this.toasts, toast];

		// Auto-dismiss after duration
		if (duration > 0) {
			setTimeout(() => {
				this.dismiss(id);
			}, duration);
		}

		return id;
	}

	dismiss(id: string): void {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	dismissAll(): void {
		this.toasts = [];
	}

	success(message: string, duration?: number): string {
		return this.show(message, 'success', duration);
	}

	error(message: string, duration?: number): string {
		return this.show(message, 'error', duration);
	}

	info(message: string, duration?: number): string {
		return this.show(message, 'info', duration);
	}
}

export const toastStore = new ToastStore();
