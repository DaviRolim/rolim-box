import { describe, expect, test } from 'bun:test';
import { pickTake } from '../src/lib/services/voice-player';

describe('pickTake', () => {
	test('a cue with one take always plays it', () => {
		expect(pickTake(1, undefined)).toBe(1);
		expect(pickTake(1, 1)).toBe(1);
	});

	test('first pick covers every take', () => {
		expect(pickTake(3, undefined, () => 0)).toBe(1);
		expect(pickTake(3, undefined, () => 0.5)).toBe(2);
		expect(pickTake(3, undefined, () => 0.99)).toBe(3);
	});

	test('never repeats the previous take', () => {
		for (const previous of [1, 2, 3]) {
			for (let i = 0; i < 50; i++) {
				const take = pickTake(3, previous, () => i / 50);
				expect(take).not.toBe(previous);
				expect(take).toBeGreaterThanOrEqual(1);
				expect(take).toBeLessThanOrEqual(3);
			}
		}
	});

	test('two takes alternate', () => {
		expect(pickTake(2, 1, () => 0.3)).toBe(2);
		expect(pickTake(2, 2, () => 0.9)).toBe(1);
	});
});
