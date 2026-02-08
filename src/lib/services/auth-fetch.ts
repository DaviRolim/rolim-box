import { clearAllCachedData } from '$lib/db/indexeddb';

/**
 * Fetch wrapper that handles 401 responses by clearing caches and redirecting to login.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const response = await fetch(input, init);

	if (response.status === 401) {
		await clearAllCachedData().catch(() => {});
		window.location.href = '/login';
	}

	return response;
}
