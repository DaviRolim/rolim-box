import { browser } from '$app/environment';
import {
	readCachedWoDs,
	readCachedWoD,
	pullWoDs,
	pullWoD,
	createWoD,
	updateWoD,
	deleteWoD,
	duplicateWoD
} from '$lib/services/wod';
import { discardFailedOperations } from '$lib/services/sync-queue';
import { syncStore } from '$lib/stores/sync.svelte';
import type { CreateWoDInput, UpdateWoDInput, WoD } from '$lib/types/wod';

/** Do not hit the server again if the list was refreshed this recently. */
const FRESH_FOR_MS = 30_000;

/**
 * The WoDs of the active workspace, kept reactive for every screen.
 *
 * `open()` shows what is saved on the device straight away, then refreshes from the server and
 * updates the same list in place. While nothing is saved yet and the first answer has not come
 * back, `loading` stays true, so a screen never says "no WoD today" before it actually knows.
 */
class WodStore {
	workspaceId = $state<string | null>(null);
	/** Newest date first. */
	wods = $state<WoD[]>([]);
	/** Nothing to show yet: first read of the cache / first answer from the server. */
	loading = $state(true);
	/** A refresh from the server is running. */
	refreshing = $state(false);
	/** The last refresh could not reach the server; the list may be out of date. */
	stale = $state(false);

	#openToken = 0;
	#lastPull = 0;
	#listening = false;

	/** Point the store at a workspace (or `null` when the person has none). Safe to call often. */
	async open(workspaceId: string | null | undefined): Promise<void> {
		if (!browser) return;
		this.#listen();

		if (!workspaceId) {
			this.workspaceId = null;
			this.wods = [];
			this.loading = false;
			return;
		}

		if (workspaceId === this.workspaceId) {
			if (Date.now() - this.#lastPull > FRESH_FOR_MS) void this.refresh();
			return;
		}

		const token = ++this.#openToken;
		this.workspaceId = workspaceId;
		this.wods = [];
		this.loading = true;
		this.stale = false;
		this.#lastPull = 0;

		const cached = await readCachedWoDs(workspaceId);
		if (token !== this.#openToken) return;

		if (cached.length > 0) {
			this.wods = cached;
			this.loading = false;
			void this.refresh();
		} else {
			await this.refresh();
			if (token === this.#openToken) this.loading = false;
		}
	}

	/** Re-read from the server and update the list. Resolves to whether the server answered. */
	async refresh(options: { force?: boolean } = {}): Promise<boolean> {
		const workspaceId = this.workspaceId;
		if (!browser || !workspaceId || this.refreshing) return false;

		this.refreshing = true;
		try {
			const result = await pullWoDs(workspaceId, options);
			if (workspaceId !== this.workspaceId) return false;

			this.stale = result !== 'ok';
			if (result === 'ok') {
				this.#lastPull = Date.now();
				this.wods = await readCachedWoDs(workspaceId);
			}
			return result === 'ok';
		} finally {
			this.refreshing = false;
		}
	}

	get(id: string): WoD | undefined {
		return this.wods.find((w) => w.id === id);
	}

	/** WoDs programmed for a calendar date (normally one). */
	onDate(date: string): WoD[] {
		return this.wods.filter((w) => w.date === date);
	}

	/**
	 * Find one WoD wherever it is: the list, the device cache, then the server.
	 * `null` means it does not exist; 'unavailable' means it is not saved here and the server
	 * cannot be reached right now.
	 */
	async find(id: string): Promise<WoD | null | 'unavailable'> {
		const listed = this.get(id);
		if (listed) return listed;

		const cached = await readCachedWoD(id);
		if (cached) return cached;

		const pulled = await pullWoD(id);
		return pulled === 'failed' ? 'unavailable' : pulled;
	}

	async create(input: CreateWoDInput): Promise<WoD> {
		const wod = await createWoD(input);
		if (wod.workspaceId === this.workspaceId) this.#upsert(wod);
		return wod;
	}

	async update(id: string, input: UpdateWoDInput): Promise<WoD> {
		const wod = await updateWoD(id, input);
		if (wod.workspaceId === this.workspaceId) this.#upsert(wod);
		return wod;
	}

	async duplicate(id: string, date?: string): Promise<WoD> {
		const wod = await duplicateWoD(id, date);
		if (wod.workspaceId === this.workspaceId) this.#upsert(wod);
		return wod;
	}

	async remove(id: string): Promise<void> {
		await deleteWoD(id);
		this.wods = this.wods.filter((w) => w.id !== id);
	}

	/** Give up on changes the server refused and go back to what the server has. */
	async discardFailedChanges(): Promise<void> {
		await discardFailedOperations();
		this.#lastPull = 0;
		await this.refresh({ force: true });
	}

	#upsert(wod: WoD): void {
		this.wods = [wod, ...this.wods.filter((w) => w.id !== wod.id)].sort(
			(a, b) => b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime()
		);
	}

	/** Pick up changes made by a coach while the app sat in the background. */
	#listen(): void {
		if (this.#listening) return;
		this.#listening = true;

		const refreshIfStale = () => {
			if (document.visibilityState !== 'visible' || !syncStore.isOnline) return;
			if (Date.now() - this.#lastPull > FRESH_FOR_MS) void this.refresh();
		};
		document.addEventListener('visibilitychange', refreshIfStale);
		window.addEventListener('online', refreshIfStale);
	}
}

export const wodStore = new WodStore();
