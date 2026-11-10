import { describe, expect, test } from 'bun:test';
import {
	addDays,
	diffDays,
	isIsoDate,
	parseIsoDate,
	relativeDay,
	startOfWeek,
	timeAgo,
	toIsoDate,
	weekDays,
	weekLabel
} from '$lib/date';

describe('calendar dates', () => {
	test('round-trips a local date', () => {
		expect(toIsoDate(parseIsoDate('2026-11-10'))).toBe('2026-11-10');
		expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
	});

	test('rejects things that are not real dates', () => {
		expect(isIsoDate('2026-11-10')).toBe(true);
		expect(isIsoDate('2026-02-30')).toBe(false);
		expect(isIsoDate('10/11/2026')).toBe(false);
		expect(isIsoDate(null)).toBe(false);
	});

	test('adds days across months and years', () => {
		expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
		expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
		expect(diffDays('2026-11-10', '2026-11-17')).toBe(7);
		expect(diffDays('2026-11-10', '2026-11-09')).toBe(-1);
	});

	test('weeks start on Monday', () => {
		expect(startOfWeek('2026-11-10')).toBe('2026-11-09'); // a Tuesday
		expect(startOfWeek('2026-11-15')).toBe('2026-11-09'); // the Sunday of that week
		expect(weekDays('2026-11-10')).toHaveLength(7);
		expect(weekDays('2026-11-10')[6]).toBe('2026-11-15');
	});

	test('names the days and weeks around today', () => {
		expect(relativeDay('2026-11-10', '2026-11-10')).toBe('Today');
		expect(relativeDay('2026-11-11', '2026-11-10')).toBe('Tomorrow');
		expect(relativeDay('2026-11-09', '2026-11-10')).toBe('Yesterday');
		expect(relativeDay('2026-11-20', '2026-11-10')).toBeNull();
		expect(weekLabel('2026-11-09', '2026-11-10')).toBe('This week');
		expect(weekLabel('2026-11-02', '2026-11-10')).toBe('Last week');
		expect(weekLabel('2026-11-16', '2026-11-10')).toBe('Next week');
	});

	test('timeAgo', () => {
		const now = 1_800_000_000_000;
		expect(timeAgo(now - 10_000, now)).toBe('just now');
		expect(timeAgo(now - 5 * 60_000, now)).toBe('5 min ago');
		expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3 h ago');
	});
});
