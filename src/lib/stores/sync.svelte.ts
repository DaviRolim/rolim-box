import { browser } from '$app/environment';

export interface FailedChange {
	id: string;
	entity: 'wod' | 'pr' | 'bank';
	type: 'create' | 'update' | 'delete';
	entityId: string;
	error: string;
}

export type SyncStatus = 'offline' | 'unreachable' | 'error' | 'syncing' | 'pending' | 'synced';

/**
 * Connection and sync state for the whole app, shown by the status chip and the Settings page.
 * The sync queue and the WoD store report into it; nothing here talks to the network.
 */
class SyncStore {
	#isOnline = $state(browser ? navigator.onLine : true);

	/** Changes saved on this device that have not reached the server yet. */
	pending = $state(0);
	/** Changes the server refused. They need a decision (see Settings). */
	failed = $state<FailedChange[]>([]);
	/** The queue is sending changes right now. */
	syncing = $state(false);
	/** Online according to the browser, but the last request to the server did not get through. */
	unreachable = $state(false);
	/** Last time fresh WoDs were read from the server (ms since epoch). */
	lastSyncedAt = $state<number | null>(null);

	constructor() {
		if (browser) {
			window.addEventListener('online', () => {
				this.#isOnline = true;
				this.unreachable = false;
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

	/** One word for the chip. The first that applies wins. */
	get status(): SyncStatus {
		if (!this.#isOnline) return 'offline';
		if (this.failed.length > 0) return 'error';
		if (this.unreachable) return 'unreachable';
		if (this.syncing) return 'syncing';
		if (this.pending > 0) return 'pending';
		return 'synced';
	}

	/** Call after any request to the server succeeds or fails at the network level. */
	reportReachable(ok: boolean): void {
		this.unreachable = !ok && this.#isOnline;
	}
}

export const syncStore = new SyncStore();
