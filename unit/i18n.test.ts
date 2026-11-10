import { afterEach, describe, expect, test } from 'bun:test';
import { dictionaries, parseLocale, setLocaleSource, t, type Locale } from '$lib/i18n';
import {
	formatDayMonth,
	formatLong,
	formatShort,
	relativeDay,
	timeAgo,
	weekLabel
} from '$lib/date';

/** Every key path in a dictionary, with functions marked by their arity. */
function shape(value: unknown, path = ''): string[] {
	if (typeof value === 'function') return [`${path}()${value.length}`];
	if (value && typeof value === 'object') {
		return Object.entries(value).flatMap(([key, child]) => shape(child, `${path}.${key}`));
	}
	return [path];
}

let locale: Locale = 'en';
setLocaleSource(() => locale);
afterEach(() => {
	locale = 'en';
});

describe('dictionaries', () => {
	test('Portuguese has exactly the keys English has', () => {
		// The type system already enforces this; this guards against `as` casts slipping in.
		expect(shape(dictionaries.pt).sort()).toEqual(shape(dictionaries.en).sort());
	});

	test('no Portuguese string is left empty', () => {
		const empty = shape(dictionaries.pt).filter((path) => {
			const value = path
				.slice(1)
				.split('.')
				.reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], dictionaries.pt);
			return value === '';
		});
		expect(empty).toEqual([]);
	});

	test('t follows the active locale', () => {
		expect(t.shell.nav.today).toBe('Today');
		locale = 'pt';
		expect(t.shell.nav.today).toBe('Hoje');
	});

	test('anything that is not a known locale is English', () => {
		expect(parseLocale('pt')).toBe('pt');
		expect(parseLocale('pt-BR')).toBe('en');
		expect(parseLocale(undefined)).toBe('en');
	});
});

describe('dates in Portuguese', () => {
	test('day and month names come from Intl, without abbreviation dots', () => {
		locale = 'pt';
		expect(formatShort('2026-11-10', '2026-11-10')).toBe('ter 10 nov');
		expect(formatDayMonth('2025-03-04', '2026-11-10')).toBe('4 mar 2025');
		expect(formatLong('2026-11-10')).toBe('terça-feira, 10 de novembro');
	});

	test('relative words are translated', () => {
		locale = 'pt';
		expect(relativeDay('2026-11-11', '2026-11-10')).toBe('Amanhã');
		expect(weekLabel('2026-11-02', '2026-11-10')).toBe('Semana passada');
		expect(timeAgo(0, 3 * 60_000)).toBe('há 3 min');
	});

	test('English keeps its day-first format', () => {
		expect(formatShort('2026-11-10', '2026-11-10')).toBe('Tue 10 Nov');
		expect(formatLong('2026-11-10')).toBe('Tuesday 10 November');
	});
});
