import { describe, expect, test } from 'bun:test';
import {
	formatTime,
	formatTimeMs,
	getTotalDuration,
	parseTimerConfig,
	serializeTimerConfig
} from '$lib/types/timer';

describe('timer config', () => {
	test('total duration per format', () => {
		expect(getTotalDuration({ type: 'amrap', duration: 1200 })).toBe(1200);
		expect(getTotalDuration({ type: 'fortime', duration: 600 })).toBe(600);
		expect(getTotalDuration({ type: 'emom', rounds: 10, intervalWork: 60 })).toBe(600);
		expect(
			getTotalDuration({ type: 'tabata', rounds: 8, intervalWork: 20, intervalRest: 10 })
		).toBe(240);
	});

	test('parses what it serialises and refuses anything out of range', () => {
		const config = { type: 'emom', rounds: 8, intervalWork: 60 } as const;
		expect(parseTimerConfig(serializeTimerConfig(config))).toEqual(config);
		expect(parseTimerConfig(null)).toBeNull();
		expect(parseTimerConfig('not json')).toBeNull();
		expect(parseTimerConfig(JSON.stringify({ type: 'amrap', duration: 5 }))).toBeNull();
		expect(parseTimerConfig(JSON.stringify({ type: 'tabata', rounds: 8 }))).toBeNull();
	});

	test('formats the clock, rounding a running second up', () => {
		expect(formatTime(0)).toBe('00:00');
		expect(formatTime(272)).toBe('04:32');
		expect(formatTimeMs(59_001)).toBe('01:00');
		expect(formatTimeMs(1)).toBe('00:01');
	});
});
