/**
 * Calendar-date helpers.
 *
 * WoDs are stored against a plain calendar date ("2026-11-10"). Everything here works in the
 * device's local time zone on purpose: `new Date().toISOString()` is UTC, which in João Pessoa
 * (UTC-3) flips to "tomorrow" at 9pm and would show the wrong WoD to the evening class.
 */

import { dictFor } from '$lib/i18n';
import { currentLocale, intlLocale } from '$lib/i18n/locale';

// Names of days and months come from Intl in the active language. English is en-GB: day-first
// ("Tue 10 Nov"), the order people read dates in Brazil. Portuguese drops Intl's abbreviation
// dots ("ter." -> "ter", "nov." -> "nov") so it reads like a scoreboard, not a form.
const undot = (text: string) => (currentLocale() === 'pt' ? text.replace(/\./g, '') : text);
const fmt = (iso: string, options: Intl.DateTimeFormatOptions) =>
	parseIsoDate(iso).toLocaleDateString(intlLocale(), options);

/** Local calendar date as YYYY-MM-DD. */
export function toIsoDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function todayIso(): string {
	return toIsoDate(new Date());
}

export function isIsoDate(value: unknown): value is string {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	return toIsoDate(parseIsoDate(value)) === value;
}

/** Parse YYYY-MM-DD as a local date (at noon, so DST shifts can never change the day). */
export function parseIsoDate(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(iso: string, days: number): string {
	const date = parseIsoDate(iso);
	date.setDate(date.getDate() + days);
	return toIsoDate(date);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: string, to: string): number {
	const ms = parseIsoDate(to).getTime() - parseIsoDate(from).getTime();
	return Math.round(ms / 86_400_000);
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
	const date = parseIsoDate(iso);
	const mondayOffset = (date.getDay() + 6) % 7;
	return addDays(iso, -mondayOffset);
}

/** The seven dates (Mon..Sun) of the week containing `iso`. */
export function weekDays(iso: string): string[] {
	const monday = startOfWeek(iso);
	return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function formatWeekday(iso: string, style: 'long' | 'short' | 'narrow' = 'short'): string {
	return undot(fmt(iso, { weekday: style }));
}

export function dayOfMonth(iso: string): number {
	return parseIsoDate(iso).getDate();
}

export function formatMonth(iso: string, style: 'long' | 'short' = 'short'): string {
	return undot(fmt(iso, { month: style }));
}

/** "10 Nov" / "10 nov" (adds the year when it is not the current one). */
export function formatDayMonth(iso: string, today: string = todayIso()): string {
	const sameYear = iso.slice(0, 4) === today.slice(0, 4);
	const parts = [String(dayOfMonth(iso)), formatMonth(iso, 'short')];
	if (!sameYear) parts.push(iso.slice(0, 4));
	return parts.join(' ');
}

/** "Tue 10 Nov" / "ter 10 nov" */
export function formatShort(iso: string, today: string = todayIso()): string {
	return `${formatWeekday(iso, 'short')} ${formatDayMonth(iso, today)}`;
}

/** "Tuesday 10 November" / "terça-feira, 10 de novembro" */
export function formatLong(iso: string): string {
	if (currentLocale() === 'pt') return fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' });
	return `${fmt(iso, { weekday: 'long' })} ${fmt(iso, { day: 'numeric', month: 'long' })}`;
}

const words = () => dictFor(currentLocale()).date;

/** "Today", "Tomorrow", "Yesterday", or null for any other day. */
export function relativeDay(iso: string, today: string = todayIso()): string | null {
	switch (diffDays(today, iso)) {
		case 0:
			return words().today;
		case 1:
			return words().tomorrow;
		case -1:
			return words().yesterday;
		default:
			return null;
	}
}

/** Heading for a week in the history list: "This week", "Last week", or "27 Oct – 2 Nov". */
export function weekLabel(weekStart: string, today: string = todayIso()): string {
	const weeks = Math.round(diffDays(startOfWeek(today), weekStart) / 7);
	if (weeks === 0) return words().thisWeek;
	if (weeks === -1) return words().lastWeek;
	if (weeks === 1) return words().nextWeek;
	return `${formatDayMonth(weekStart, today)} – ${formatDayMonth(addDays(weekStart, 6), today)}`;
}

/** "just now", "5 min ago", "2 h ago", "3 d ago" */
export function timeAgo(timestamp: number, now: number = Date.now()): string {
	const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
	if (seconds < 45) return words().justNow;
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return words().minutesAgo(minutes);
	const hours = Math.round(minutes / 60);
	if (hours < 24) return words().hoursAgo(hours);
	return words().daysAgo(Math.round(hours / 24));
}
