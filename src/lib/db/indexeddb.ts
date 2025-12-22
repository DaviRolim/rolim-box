import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { browser } from '$app/environment';

interface RolimBoxDB extends DBSchema {
	wods: {
		key: string;
		value: {
			id: string;
			workspaceId: string;
			date: string;
			description: string | null;
			createdAt: number;
			updatedAt: number;
		};
		indexes: {
			'by-workspace': string;
			'by-date': string;
		};
	};
	sections: {
		key: string;
		value: {
			id: string;
			wodId: string;
			type: string;
			name: string;
			content: string;
			order: number;
			timerConfig: string | null;
		};
		indexes: {
			'by-wod': string;
		};
	};
	syncMeta: {
		key: string;
		value: {
			key: string;
			timestamp: number;
		};
	};
}

const DB_NAME = 'rolimbox';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RolimBoxDB>> | null = null;

function getDB(): Promise<IDBPDatabase<RolimBoxDB>> {
	if (!browser) {
		throw new Error('IndexedDB is only available in the browser');
	}

	if (!dbPromise) {
		dbPromise = openDB<RolimBoxDB>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				// WoDs store
				if (!db.objectStoreNames.contains('wods')) {
					const wodStore = db.createObjectStore('wods', { keyPath: 'id' });
					wodStore.createIndex('by-workspace', 'workspaceId');
					wodStore.createIndex('by-date', 'date');
				}

				// Sections store
				if (!db.objectStoreNames.contains('sections')) {
					const sectionStore = db.createObjectStore('sections', { keyPath: 'id' });
					sectionStore.createIndex('by-wod', 'wodId');
				}

				// Sync metadata store
				if (!db.objectStoreNames.contains('syncMeta')) {
					db.createObjectStore('syncMeta', { keyPath: 'key' });
				}
			}
		});
	}

	return dbPromise;
}

// WoD operations
export async function cacheWod(wod: RolimBoxDB['wods']['value']): Promise<void> {
	const db = await getDB();
	await db.put('wods', wod);
}

export async function cacheWods(wods: RolimBoxDB['wods']['value'][]): Promise<void> {
	const db = await getDB();
	const tx = db.transaction('wods', 'readwrite');
	await Promise.all([...wods.map((wod) => tx.store.put(wod)), tx.done]);
}

export async function getCachedWod(id: string): Promise<RolimBoxDB['wods']['value'] | undefined> {
	const db = await getDB();
	return db.get('wods', id);
}

export async function getCachedWodsByWorkspace(
	workspaceId: string
): Promise<RolimBoxDB['wods']['value'][]> {
	const db = await getDB();
	return db.getAllFromIndex('wods', 'by-workspace', workspaceId);
}

export async function deleteCachedWod(id: string): Promise<void> {
	const db = await getDB();
	await db.delete('wods', id);
}

export async function clearCachedWods(): Promise<void> {
	const db = await getDB();
	await db.clear('wods');
}

// Section operations
export async function cacheSection(section: RolimBoxDB['sections']['value']): Promise<void> {
	const db = await getDB();
	await db.put('sections', section);
}

export async function cacheSections(sections: RolimBoxDB['sections']['value'][]): Promise<void> {
	const db = await getDB();
	const tx = db.transaction('sections', 'readwrite');
	await Promise.all([...sections.map((section) => tx.store.put(section)), tx.done]);
}

export async function getCachedSectionsByWod(
	wodId: string
): Promise<RolimBoxDB['sections']['value'][]> {
	const db = await getDB();
	return db.getAllFromIndex('sections', 'by-wod', wodId);
}

export async function deleteCachedSectionsByWod(wodId: string): Promise<void> {
	const db = await getDB();
	const sections = await db.getAllFromIndex('sections', 'by-wod', wodId);
	const tx = db.transaction('sections', 'readwrite');
	await Promise.all([...sections.map((s) => tx.store.delete(s.id)), tx.done]);
}

export async function clearCachedSections(): Promise<void> {
	const db = await getDB();
	await db.clear('sections');
}

// Sync metadata
export async function setLastSync(timestamp: number): Promise<void> {
	const db = await getDB();
	await db.put('syncMeta', { key: 'lastSync', timestamp });
}

export async function getLastSync(): Promise<number | null> {
	const db = await getDB();
	const meta = await db.get('syncMeta', 'lastSync');
	return meta?.timestamp ?? null;
}

// Clear all data (for logout)
export async function clearAllCachedData(): Promise<void> {
	const db = await getDB();
	await Promise.all([db.clear('wods'), db.clear('sections'), db.clear('syncMeta')]);
}
