/**
 * Presentation helpers for WoDs: headline, summary, timer labels and the "whiteboard"
 * formatting of free-text section content. Pure functions, no DOM.
 */
import type { Section, WoD } from '$lib/types/wod';
import { parseTimerConfig, type TimerConfig } from '$lib/types/timer';

// ---------------------------------------------------------------------------
// Timers
// ---------------------------------------------------------------------------

/** 90 -> "1:30", 600 -> "10:00" */
export function clock(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${String(s).padStart(2, '0')}`;
}

/** 600 -> "10 min", 90 -> "1:30", 45 -> "45s" */
export function duration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	if (seconds % 60 === 0) return `${seconds / 60} min`;
	return clock(seconds);
}

/** Short label for a timer, e.g. "AMRAP 20 min", "For time · 10 min cap". */
export function timerLabel(config: TimerConfig): string {
	switch (config.type) {
		case 'amrap':
			return `AMRAP ${duration(config.duration ?? 0)}`;
		case 'fortime':
			return `For time · ${duration(config.duration ?? 0)} cap`;
		case 'emom': {
			const rounds = config.rounds ?? 0;
			const interval = config.intervalWork ?? 60;
			return interval === 60
				? `EMOM ${rounds} min`
				: `Every ${duration(interval)} × ${rounds}`;
		}
		case 'tabata':
			return `Tabata ${config.rounds ?? 0} × ${config.intervalWork ?? 0}s/${config.intervalRest ?? 0}s`;
	}
}

/** Even shorter, for tight chips: "AMRAP 20′", "FT 10′", "EMOM 8′", "TABATA". */
export function timerChip(config: TimerConfig): string {
	const minutes = (s: number) => (s % 60 === 0 ? `${s / 60}′` : clock(s));
	switch (config.type) {
		case 'amrap':
			return `AMRAP ${minutes(config.duration ?? 0)}`;
		case 'fortime':
			return `For time ${minutes(config.duration ?? 0)}`;
		case 'emom':
			return `EMOM ${minutes((config.rounds ?? 0) * (config.intervalWork ?? 60))}`;
		case 'tabata':
			return `Tabata ×${config.rounds ?? 0}`;
	}
}

export function sectionTimer(section: Pick<Section, 'timerConfig'>): TimerConfig | null {
	return parseTimerConfig(section.timerConfig);
}

// ---------------------------------------------------------------------------
// Headline & summary
// ---------------------------------------------------------------------------

const GENERIC_NAMES = new Set([
	'wod',
	'workout',
	'metcon',
	'main',
	'main wod',
	'conditioning',
	'workout of the day'
]);

/** The section people mean when they ask "what's the WoD today?" */
export function mainSection(wod: Pick<WoD, 'sections'>): Section | null {
	const sections = wod.sections;
	return (
		sections.find((s) => s.type === 'wod') ??
		sections.find((s) => s.timerConfig) ??
		sections[0] ??
		null
	);
}

/** Headline for a WoD. The data model has no title, so derive one. */
export function wodTitle(wod: Pick<WoD, 'sections' | 'description'>): string {
	const main = mainSection(wod);
	if (!main) return firstSentence(wod.description) || 'Untitled WoD';

	const name = main.name.trim();
	if (name && !GENERIC_NAMES.has(name.toLowerCase())) {
		const others = wod.sections.filter((s) => s.type === 'wod' && s.id !== main.id).length;
		return others > 0 && main.type === 'wod' ? `${name} +${others}` : name;
	}

	const timer = sectionTimer(main);
	if (timer) return timerChip(timer);
	return name || 'Workout';
}

/** One line under the headline: the coach's note, or the first movements. */
export function wodSummary(wod: Pick<WoD, 'sections' | 'description'>): string {
	if (wod.description?.trim()) return wod.description.trim();
	const main = mainSection(wod);
	if (!main) return '';
	return main.content
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, 4)
		.join(' · ');
}

function firstSentence(text: string | null | undefined): string {
	if (!text) return '';
	const trimmed = text.trim();
	const match = trimmed.match(/^(.+?[.!?])(\s|$)/);
	return (match ? match[1] : trimmed).slice(0, 60);
}

/** Everything searchable about a WoD, lower-cased. */
export function wodSearchText(wod: WoD): string {
	return [wod.description ?? '', ...wod.sections.flatMap((s) => [s.name, s.content])]
		.join('\n')
		.toLowerCase();
}

// ---------------------------------------------------------------------------
// Whiteboard formatting
// ---------------------------------------------------------------------------

export type BoardLine =
	| { kind: 'gap' }
	| { kind: 'heading'; text: string }
	| { kind: 'move'; qty: string | null; text: string }
	| { kind: 'note'; text: string };

// "21", "400m", "2 min", "15/12 cal", "5 x 5", "21-15-9", "90s", "1000m"
const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const UNIT = String.raw`(?:m|km|cal|cals|kg|lb|lbs|min|mins|sec|secs|s|%|x)`;
const QTY = new RegExp(
	String.raw`^(${NUMBER}(?:\s?[-–/x×]\s?${NUMBER})*(?:\s?${UNIT}\b)?)(?:\s+(.+))?$`,
	'i'
);
const NOTE_PREFIX = /^(time cap|cap|score|scale|scaled|rx|rest|note|goal|tip)\b/i;
// "Min 1: 15 cal row", "Odd: 6 handstand push-ups", "Station 2: wall balls"
const SLOT = /^((?:min|minute|round|station|part)\s?\d+|odd|even|a|b|c)\s*:\s*(\S.*)$/i;

/**
 * Turn the coach's free text into lines a whiteboard would have: sub-headings ("3 rounds:"),
 * movements with the rep count pulled out so it can be set bold, and quieter notes.
 * It only decides how a line is drawn. No text is added, dropped or reordered.
 */
export function parseBoard(content: string): BoardLine[] {
	const lines: BoardLine[] = [];
	let afterGap = false;

	for (const raw of content.replace(/\r\n?/g, '\n').split('\n')) {
		const line = raw.replace(/^\s*[-•*]\s+/, '').trim();

		if (!line) {
			if (lines.length > 0 && lines[lines.length - 1].kind !== 'gap') lines.push({ kind: 'gap' });
			afterGap = true;
			continue;
		}

		if (line.endsWith(':')) {
			lines.push({ kind: 'heading', text: line.slice(0, -1) });
		} else if (NOTE_PREFIX.test(line)) {
			lines.push({ kind: 'note', text: line });
		} else if (SLOT.test(line)) {
			const [, slot, rest] = line.match(SLOT)!;
			lines.push({ kind: 'move', qty: slot, text: rest });
		} else {
			const match = line.match(QTY);
			if (match) {
				lines.push({ kind: 'move', qty: match[1], text: match[2] ?? '' });
			} else if (afterGap && lines.length > 0 && /[.!?]$/.test(line)) {
				// A full sentence after a blank line is commentary, not a movement.
				lines.push({ kind: 'note', text: line });
			} else {
				lines.push({ kind: 'move', qty: null, text: line });
			}
		}
		afterGap = false;
	}

	while (lines.length > 0 && lines[lines.length - 1].kind === 'gap') lines.pop();
	return lines;
}
