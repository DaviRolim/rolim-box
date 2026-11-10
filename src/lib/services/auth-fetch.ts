import { forgetDevice } from '$lib/services/session';

/**
 * Fetch wrapper for the signed-in app: when the server says the session is gone (401), forget
 * what this device stored about the person and send them to the login page.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const response = await fetch(input, init);

	if (response.status === 401) {
		await forgetDevice();
		window.location.href = '/login';
	}

	return response;
}
