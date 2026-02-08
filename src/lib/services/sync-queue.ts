import { browser } from '$app/environment';
import { syncStore } from '$lib/stores/sync.svelte';
import { toastStore } from '$lib/stores/toast.svelte';
import {
	addToSyncQueue,
	getAllSyncQueueOperations,
	deleteSyncQueueOperation,
	updateSyncQueueOperation,
	clearSyncQueueForEntity
} from '$lib/db/indexeddb';
import { generateId } from '$lib/utils';

// ============================================================================
// Types
// ============================================================================

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
}

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

// ============================================================================
// State Management
// ============================================================================

const inFlightOperations = new Set<string>();
const pendingRetries = new Map<string, ReturnType<typeof setTimeout>>();

// ============================================================================
// Queue Operations
// ============================================================================

/**
 * Add an operation to the sync queue
 */
export async function queueOperation(
	op: Omit<SyncOperation, 'id' | 'createdAt' | 'retries'>
): Promise<void> {
	if (!browser) return;

	const operation: SyncOperation = {
		...op,
		id: generateId(),
		createdAt: Date.now(),
		retries: 0,
		status: 'pending'
	};

	try {
		await addToSyncQueue(operation);
	} catch (error) {
		console.error('Failed to add operation to sync queue:', error);
		throw error;
	}

	// If online, trigger immediate sync
	if (syncStore.isOnline) {
		processQueue();
	}
}

/**
 * Get all queued operations
 */
export async function getQueuedOperations(): Promise<SyncOperation[]> {
	if (!browser) return [];
	try {
		return (await getAllSyncQueueOperations()) as SyncOperation[];
	} catch (error) {
		console.error('Failed to get queued operations:', error);
		return [];
	}
}

/**
 * Clear all queued operations for a specific entity
 */
export async function clearQueuedOperations(entityId: string): Promise<void> {
	if (!browser) return;
	try {
		// Clear any pending retries for this entity
		const operations = await getAllSyncQueueOperations();
		for (const op of operations) {
			if (op.entityId === entityId) {
				const timeoutId = pendingRetries.get(op.id);
				if (timeoutId) {
					clearTimeout(timeoutId);
					pendingRetries.delete(op.id);
				}
			}
		}
		await clearSyncQueueForEntity(entityId);
	} catch (error) {
		console.error('Failed to clear queued operations:', error);
		throw error;
	}
}

// ============================================================================
// Queue Processing
// ============================================================================

let isProcessing = false;

/**
 * Process all pending operations in the queue
 * Called when transitioning from offline to online
 */
export async function processQueue(): Promise<void> {
	if (!browser || !syncStore.isOnline || isProcessing) return;

	isProcessing = true;

	try {
		const operations = await getAllSyncQueueOperations();

		// Filter out failed operations and sort by createdAt to maintain FIFO order
		const pendingOperations = operations.filter((op) => op.status === 'pending');
		pendingOperations.sort((a, b) => a.createdAt - b.createdAt);

		for (const operation of pendingOperations) {
			await processOperation(operation as SyncOperation);
		}
	} catch (error) {
		console.error('Error processing sync queue:', error);
	} finally {
		isProcessing = false;
	}
}

/**
 * Process a single sync operation
 */
async function processOperation(operation: SyncOperation): Promise<void> {
	// Check if operation is already being processed
	if (inFlightOperations.has(operation.id)) {
		return;
	}

	inFlightOperations.add(operation.id);

	try {
		await executeSyncOperation(operation);
		// Success - remove from queue and clear any pending retry
		const timeoutId = pendingRetries.get(operation.id);
		if (timeoutId) {
			clearTimeout(timeoutId);
			pendingRetries.delete(operation.id);
		}
		try {
			await deleteSyncQueueOperation(operation.id);
		} catch (error) {
			console.error(`Failed to delete operation ${operation.id} from queue:`, error);
		}
	} catch (error) {
		console.error(`Failed to sync operation ${operation.id}:`, error);

		// Increment retry count
		operation.retries += 1;

		if (operation.retries >= MAX_RETRIES) {
			// Max retries reached - mark as failed
			console.error(
				`Operation ${operation.id} failed after ${MAX_RETRIES} retries. Marking as failed.`
			);
			operation.status = 'failed';
			operation.failedAt = Date.now();
			toastStore.error(
				'Failed to sync changes. Your edits are saved locally and will retry when possible.',
				0
			);
			try {
				await updateSyncQueueOperation(operation);
			} catch (updateError) {
				console.error(`Failed to update operation ${operation.id} status:`, updateError);
			}
		} else {
			// Schedule retry with exponential backoff
			if (operation.retries === 1) {
				toastStore.info('Syncing changes...retrying');
			}
			const delay = RETRY_DELAYS[operation.retries - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];

			try {
				await updateSyncQueueOperation(operation);
			} catch (updateError) {
				console.error(`Failed to update operation ${operation.id} retry count:`, updateError);
			}

			// Retry after delay
			const timeoutId = setTimeout(async () => {
				pendingRetries.delete(operation.id);
				if (syncStore.isOnline) {
					await processOperation(operation);
				}
			}, delay);
			pendingRetries.set(operation.id, timeoutId);
		}
	} finally {
		inFlightOperations.delete(operation.id);
	}
}

/**
 * Execute a sync operation by calling the appropriate API endpoint
 */
async function executeSyncOperation(operation: SyncOperation): Promise<void> {
	const { type, entity, entityId, payload } = operation;

	if (entity === 'wod') {
		switch (type) {
			case 'create': {
				const response = await fetch('/api/wods', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(payload)
				});

				if (!response.ok) {
					let errorMessage = 'Failed to create WoD';
					try {
						const error = await response.json();
						errorMessage = error.error || errorMessage;
					} catch {
						// Response has no JSON body
					}
					throw new Error(errorMessage);
				}
				break;
			}

			case 'update': {
				const response = await fetch(`/api/wods/${entityId}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(payload)
				});

				if (!response.ok) {
					let errorMessage = 'Failed to update WoD';
					try {
						const error = await response.json();
						errorMessage = error.error || errorMessage;
					} catch {
						// Response has no JSON body
					}
					throw new Error(errorMessage);
				}
				break;
			}

			case 'delete': {
				const response = await fetch(`/api/wods/${entityId}`, {
					method: 'DELETE'
				});

				if (!response.ok && response.status !== 204) {
					let errorMessage = 'Failed to delete WoD';
					try {
						const error = await response.json();
						errorMessage = error.error || errorMessage;
					} catch {
						// Response has no JSON body
					}
					throw new Error(errorMessage);
				}
				break;
			}

			default:
				throw new Error(`Unsupported operation type: ${type}`);
		}
	} else if (entity === 'pr') {
		switch (type) {
			case 'create': {
				const response = await fetch('/api/prs', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(payload)
				});

				if (!response.ok) {
					let errorMessage = 'Failed to create PR';
					try {
						const error = await response.json();
						errorMessage = error.error || errorMessage;
					} catch {
						// Response has no JSON body
					}
					throw new Error(errorMessage);
				}
				break;
			}

			case 'delete': {
				const response = await fetch(`/api/prs/${entityId}`, {
					method: 'DELETE'
				});

				if (!response.ok && response.status !== 204) {
					let errorMessage = 'Failed to delete PR';
					try {
						const error = await response.json();
						errorMessage = error.error || errorMessage;
					} catch {
						// Response has no JSON body
					}
					throw new Error(errorMessage);
				}
				break;
			}

			default:
				throw new Error(`Unsupported operation type for PR: ${type}`);
		}
	} else {
		throw new Error(`Unsupported entity type: ${entity}`);
	}
}

// ============================================================================
// Sync Trigger Setup
// ============================================================================

/**
 * Initialize sync queue listener
 * Call this once when the app starts
 */
export function initializeSyncQueue(): void {
	if (!browser) return;

	let wasOnline = navigator.onLine;

	window.addEventListener('online', () => {
		if (!wasOnline) {
			console.log('Back online - processing sync queue');
			processQueue();
		}
		wasOnline = true;
	});

	window.addEventListener('offline', () => {
		wasOnline = false;
	});

	// Also process queue on init if online
	if (navigator.onLine) {
		processQueue();
	}
}

// Auto-initialize when module is imported in browser
if (browser) {
	initializeSyncQueue();
}
