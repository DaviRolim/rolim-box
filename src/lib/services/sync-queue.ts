import { browser } from '$app/environment';
import { syncStore, type FailedChange } from '$lib/stores/sync.svelte';
import { toastStore } from '$lib/stores/toast.svelte';
import {
	addToSyncQueue,
	getAllSyncQueueOperations,
	deleteSyncQueueOperation,
	updateSyncQueueOperation,
	clearSyncQueueForEntity
} from '$lib/db/indexeddb';
import { generateId } from '$lib/utils';
import { t } from '$lib/i18n';

/**
 * Outbox for changes made on this device.
 *
 * Every write (create / update / delete) is applied to IndexedDB first and recorded here, then
 * sent to the server in the order it was made. An operation has one of two states:
 *
 *  - pending: not on the server yet. Retried automatically: right away, with a short back-off,
 *    when the connection comes back, when the app is opened or brought to the foreground, and
 *    on "Sync now".
 *  - failed: the server refused it (no permission, invalid, target gone). Retrying will not
 *    help, so it waits for the person to discard it in Settings.
 */

export interface SyncOperation {
	id: string;
	type: 'create' | 'update' | 'delete';
	entity: 'wod' | 'pr';
	entityId: string;
	payload: unknown;
	createdAt: number;
	retries: number;
	status: 'pending' | 'failed';
	failedAt?: number;
	error?: string;
}

const RETRY_DELAYS = [1000, 2000, 4000, 8000];

let isProcessing = false;
let runAgain = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;

// ============================================================================
// Queue access
// ============================================================================

/** Record a change and try to send it. */
export async function queueOperation(
	op: Omit<SyncOperation, 'id' | 'createdAt' | 'retries'>
): Promise<void> {
	if (!browser) return;

	await addToSyncQueue({
		...op,
		id: generateId(),
		createdAt: Date.now(),
		retries: 0,
		status: 'pending'
	});
	await publishState();
	void processQueue();
}

export async function getQueuedOperations(): Promise<SyncOperation[]> {
	if (!browser) return [];
	try {
		return (await getAllSyncQueueOperations()) as SyncOperation[];
	} catch (error) {
		console.error('Failed to read the sync queue:', error);
		return [];
	}
}

/** Ids of everything with a change that has not been accepted by the server. */
export async function getUnsyncedEntityIds(): Promise<Set<string>> {
	const operations = await getQueuedOperations();
	return new Set(operations.map((op) => op.entityId));
}

/** Drop every queued operation for one entity. */
export async function clearQueuedOperations(entityId: string): Promise<void> {
	if (!browser) return;
	await clearSyncQueueForEntity(entityId);
	await publishState();
}

/** Throw away the changes the server refused. Returns what was discarded. */
export async function discardFailedOperations(): Promise<SyncOperation[]> {
	const failed = (await getQueuedOperations()).filter((op) => op.status === 'failed');
	for (const op of failed) {
		await deleteSyncQueueOperation(op.id);
	}
	await publishState();
	return failed;
}

async function publishState(): Promise<void> {
	const operations = await getQueuedOperations();
	syncStore.pending = operations.filter((op) => op.status === 'pending').length;
	syncStore.failed = operations
		.filter((op) => op.status === 'failed')
		.map(
			(op): FailedChange => ({
				id: op.id,
				entity: op.entity,
				type: op.type,
				entityId: op.entityId,
				error: op.error ?? t.settings.sync.notAccepted
			})
		);
}

// ============================================================================
// Processing
// ============================================================================

type Outcome =
	| { kind: 'done' }
	| { kind: 'rejected'; message: string } // the server said no: do not retry
	| { kind: 'retry' } // network or server trouble: try again later
	| { kind: 'auth' }; // signed out: stop until the person logs in again

/**
 * Send pending operations, oldest first. Stops at the first one that cannot be delivered right
 * now, so operations on the same WoD always reach the server in the order they were made.
 */
export async function processQueue(): Promise<void> {
	if (!browser || !syncStore.isOnline) return;
	if (isProcessing) {
		runAgain = true;
		return;
	}

	isProcessing = true;
	clearRetry();
	let stalled = false;

	try {
		const operations = (await getQueuedOperations())
			.filter((op) => op.status === 'pending')
			.sort((a, b) => a.createdAt - b.createdAt);

		if (operations.length > 0) syncStore.syncing = true;

		for (const operation of operations) {
			const outcome = await send(operation);

			if (outcome.kind === 'done') {
				syncStore.reportReachable(true);
				await deleteSyncQueueOperation(operation.id);
				await publishState();
				continue;
			}

			if (outcome.kind === 'rejected') {
				syncStore.reportReachable(true);
				await updateSyncQueueOperation({
					...operation,
					status: 'failed',
					failedAt: Date.now(),
					error: outcome.message
				});
				await publishState();
				toastStore.error(t.settings.sync.notSaved(outcome.message), 8000);
				continue;
			}

			if (outcome.kind === 'retry') {
				syncStore.reportReachable(false);
				await updateSyncQueueOperation({ ...operation, retries: operation.retries + 1 });
			}
			stalled = true;
			break;
		}
	} catch (error) {
		console.error('Error processing the sync queue:', error);
		stalled = true;
	} finally {
		isProcessing = false;
		syncStore.syncing = false;
		await publishState().catch(() => {});
	}

	if (runAgain) {
		runAgain = false;
		void processQueue();
	} else if (stalled) {
		scheduleRetry();
	} else {
		retryAttempt = 0;
	}
}

/** "Sync now": start over with the back-off and try straight away. */
export function retrySync(): Promise<void> {
	retryAttempt = 0;
	return processQueue();
}

function scheduleRetry(): void {
	if (retryAttempt >= RETRY_DELAYS.length) return; // wait for the next trigger (online, foreground, manual)
	const delay = RETRY_DELAYS[retryAttempt++];
	retryTimer = setTimeout(() => {
		retryTimer = null;
		void processQueue();
	}, delay);
}

function clearRetry(): void {
	if (retryTimer) {
		clearTimeout(retryTimer);
		retryTimer = null;
	}
}

async function send(operation: SyncOperation): Promise<Outcome> {
	const request = buildRequest(operation);
	if (!request) {
		return { kind: 'rejected', message: t.settings.sync.unsupported };
	}

	let response: Response;
	try {
		response = await fetch(request.url, request.init);
	} catch {
		return { kind: 'retry' };
	}

	if (response.ok) return { kind: 'done' };
	// Deleting something that is already gone is the outcome we wanted.
	if (operation.type === 'delete' && response.status === 404) return { kind: 'done' };
	if (response.status === 401) return { kind: 'auth' };
	if (response.status === 408 || response.status === 429 || response.status >= 500) {
		return { kind: 'retry' };
	}

	let message = t.settings.sync.refusedStatus(response.status);
	try {
		const body = await response.json();
		if (typeof body?.error === 'string') message = body.error;
	} catch {
		// no JSON body
	}
	return { kind: 'rejected', message };
}

function buildRequest(operation: SyncOperation): { url: string; init: RequestInit } | null {
	const json = (method: string, body: unknown): RequestInit => ({
		method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	const { type, entity, entityId, payload } = operation;

	if (entity === 'wod') {
		if (type === 'create') return { url: '/api/wods', init: json('POST', payload) };
		if (type === 'update') return { url: `/api/wods/${entityId}`, init: json('PUT', payload) };
		if (type === 'delete') return { url: `/api/wods/${entityId}`, init: { method: 'DELETE' } };
	}
	if (entity === 'pr') {
		if (type === 'create') return { url: '/api/prs', init: json('POST', payload) };
		if (type === 'delete') return { url: `/api/prs/${entityId}`, init: { method: 'DELETE' } };
	}
	return null;
}

// ============================================================================
// Triggers
// ============================================================================

/** Wire up the automatic triggers. Runs once, when this module is first imported in the browser. */
async function initializeSyncQueue(): Promise<void> {
	// Earlier versions marked operations as failed after three network errors and never tried
	// them again. Those are deliverable, so put them back in line; only operations the server
	// refused (they carry an `error`) stay failed.
	for (const op of await getQueuedOperations()) {
		if (op.status === 'failed' && !op.error) {
			await updateSyncQueueOperation({ ...op, status: 'pending', retries: 0 });
		}
	}
	await publishState();

	window.addEventListener('online', () => void retrySync());
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') void retrySync();
	});

	void processQueue();
}

if (browser) {
	void initializeSyncQueue();
}
