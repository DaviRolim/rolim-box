import { browser } from '$app/environment';

class SyncStore {
	#isOnline = $state(browser ? navigator.onLine : true);

	constructor() {
		if (browser) {
			window.addEventListener('online', () => {
				this.#isOnline = true;
			});
			window.addEventListener('offline', () => {
				this.#isOnline = false;
			});
		}
	}

	get isOnline(): boolean {
		return this.#isOnline;
	}

	get isOffline(): boolean {
		return !this.#isOnline;
	}
}

export const syncStore = new SyncStore();
