import { encodeHexLowerCase } from '@oslojs/encoding';

/**
 * Generate a unique ID for client-side use
 * Uses crypto.getRandomValues for secure random bytes
 */
export function generateId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return encodeHexLowerCase(bytes);
}
