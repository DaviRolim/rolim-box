import { browser } from '$app/environment';
import {
	createBankWod,
	deleteBankWod,
	markScheduledLocally,
	newestFirst,
	pullBank,
	pullBankWod,
	readCachedBank,
	readCachedBankWod,
	updateBankWod
} from '$lib/services/bank';
import { bankToWodInput, wodToBankInput } from '$lib/bank';
import { wodStore } from '$lib/stores/wods.svelte';
import { syncStore } from '$lib/stores/sync.svelte';
import type { BankWod, CreateBankWodInput, UpdateBankWodInput } from '$lib/types/bank';
import type { WoD } from '$lib/types/wod';

const FRESH_FOR_MS = 30_000;

/**
 * The WoD bank of the active workspace, for coaches. Same behaviour as the WoD store: what is
 * on the phone shows at once, then the server's answer updates the list in place.
 * Athletes never open it (the layout passes `null`), so nothing of the bank is fetched or kept
 * on their phones.
 */
class BankStore {
	workspaceId = $state<string | null>(null);
	/** Newest first. */
	items = $state<BankWod[]>([]);
	loading = $state(true);
	refreshing = $state(false);
	stale = $state(false);

	#openToken = 0;
	#lastPull = 0;
	#listening = false;

	/** Point the store at a workspace the person coaches in, or `null`. Safe to call often. */
	async open(workspaceId: string | null | undefined): Promise<void> {
		if (!browser) return;
		this.#listen();

		if (!workspaceId) {
			++this.#openToken;
			this.workspaceId = null;
			this.items = [];
			this.loading = false;
			return;
		}

		if (workspaceId === this.workspaceId) {
			if (Date.now() - this.#lastPull > FRESH_FOR_MS) void this.refresh();
			return;
		}

		const token = ++this.#openToken;
		this.workspaceId = workspaceId;
		this.items = [];
		this.loading = true;
		this.stale = false;
		this.#lastPull = 0;

		const cached = await readCachedBank(workspaceId);
		if (token !== this.#openToken) return;

		if (cached.length > 0) {
			this.items = cached;
			this.loading = false;
			void this.refresh();
		} else {
			await this.refresh();
			if (token === this.#openToken) this.loading = false;
		}
	}

	async refresh(options: { force?: boolean } = {}): Promise<boolean> {
		const workspaceId = this.workspaceId;
		if (!browser || !workspaceId || this.refreshing) return false;

		this.refreshing = true;
		try {
			const result = await pullBank(workspaceId, options);
			if (workspaceId !== this.workspaceId) return false;

			this.stale = result === 'offline' || result === 'failed';
			if (result === 'ok' || result === 'forbidden') {
				this.#lastPull = Date.now();
				this.items = await readCachedBank(workspaceId);
			}
			return result === 'ok';
		} finally {
			this.refreshing = false;
		}
	}

	get(id: string): BankWod | undefined {
		return this.items.find((item) => item.id === id);
	}

	/** The list, then the phone, then the server. 'unavailable': not here and no server. */
	async find(id: string): Promise<BankWod | null | 'unavailable'> {
		const listed = this.get(id);
		if (listed) return listed;
		const cached = await readCachedBankWod(id);
		if (cached) return cached;
		const pulled = await pullBankWod(id);
		return pulled === 'failed' ? 'unavailable' : pulled;
	}

	async create(input: CreateBankWodInput): Promise<BankWod> {
		const item = await createBankWod(input);
		if (item.workspaceId === this.workspaceId) this.#upsert(item);
		return item;
	}

	async update(id: string, input: UpdateBankWodInput): Promise<BankWod> {
		const item = await updateBankWod(id, input);
		if (item.workspaceId === this.workspaceId) this.#upsert(item);
		return item;
	}

	async remove(id: string): Promise<void> {
		await deleteBankWod(id);
		this.items = this.items.filter((item) => item.id !== id);
	}

	/**
	 * Put a bank WoD on a day: a copy becomes a normal WoD on `date` (it syncs like any WoD
	 * created on this phone) and the bank entry stays, with its "last on" date moved.
	 */
	async schedule(item: BankWod, date: string): Promise<WoD> {
		const wod = await wodStore.create({
			workspaceId: item.workspaceId,
			date,
			bankWodId: item.id,
			...bankToWodInput(item)
		});
		const marked = await markScheduledLocally(item.id, date);
		if (marked && marked.workspaceId === this.workspaceId) this.#upsert(marked);
		return wod;
	}

	/** Keep a copy of a dated WoD in the bank, under `name`. */
	saveFromWod(wod: WoD, name: string): Promise<BankWod> {
		return this.create(wodToBankInput(wod, name));
	}

	/** After refused changes are thrown away, go back to what the server has. */
	async reload(): Promise<void> {
		this.#lastPull = 0;
		await this.refresh({ force: true });
	}

	#upsert(item: BankWod): void {
		this.items = [item, ...this.items.filter((other) => other.id !== item.id)].sort(newestFirst);
	}

	#listen(): void {
		if (this.#listening) return;
		this.#listening = true;

		const refreshIfStale = () => {
			if (document.visibilityState !== 'visible' || !syncStore.isOnline) return;
			if (this.workspaceId && Date.now() - this.#lastPull > FRESH_FOR_MS) void this.refresh();
		};
		document.addEventListener('visibilitychange', refreshIfStale);
		window.addEventListener('online', refreshIfStale);
	}
}

export const bankStore = new BankStore();
