import { encodeHexLowerCase } from '@oslojs/encoding';

/**
 * Generate a unique ID for client-side use
 * Uses crypto.getRandomValues for secure random bytes
 */
export function generateId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return encodeHexLowerCase(bytes);
}

/**
 * Returns a debounced version of the given function.
 * The function will only execute after `delay` ms have elapsed
 * since the last invocation.
 */
export function debounce<A extends unknown[]>(
	fn: (...args: A) => void,
	delay: number
): (...args: A) => void {
	let timeoutId: ReturnType<typeof setTimeout>;
	return (...args: A) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), delay);
	};
}
