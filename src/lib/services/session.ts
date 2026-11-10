import { clearAllCachedData } from '$lib/db/indexeddb';

/**
 * Remove everything this device remembers about the signed-in person: the local WoD / PR cache
 * and the stored copies of app pages (which contain their email and box). Built assets stay, so
 * the next person to sign in on this phone still gets an instant start.
 */
export async function forgetDevice(): Promise<void> {
	await clearAllCachedData().catch(() => {});
	if (typeof caches === 'undefined') return;
	const keys = await caches.keys().catch(() => [] as string[]);
	await Promise.all(
		keys.filter((key) => key.startsWith('rolimbox-pages')).map((key) => caches.delete(key))
	);
}
