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
			return interval === 60 ? `EMOM ${rounds} min` : `Every ${duration(interval)} × ${rounds}`;
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

// ---------------------------------------------------------------------------
// The poster: format strip and "vai doer"
// ---------------------------------------------------------------------------

/** The two cells of the scoreboard strip under a WoD's name: ["FOR TIME", "CAP 10:00"]. */
export function formatStrip(config: TimerConfig): [string, string] {
	switch (config.type) {
		case 'amrap':
			return ['AMRAP', clock(config.duration ?? 0)];
		case 'fortime':
			return ['For time', `Cap ${clock(config.duration ?? 0)}`];
		case 'emom': {
			const interval = config.intervalWork ?? 60;
			const rounds = config.rounds ?? 0;
			return ['EMOM', interval === 60 ? `${rounds} min` : `${rounds} × ${clock(interval)}`];
		}
		case 'tabata':
			return [
				'Tabata',
				`${config.rounds ?? 0} × ${config.intervalWork ?? 0}s / ${config.intervalRest ?? 0}s`
			];
	}
}

// Movements people groan at, worst first. Only used to pick which line goes on the tape.
const NASTY: [RegExp, number][] = [
	[/\bmuscle[- ]?ups?\b|\bBMU\b|\bRMU\b/i, 100],
	[/\bhandstand walk/i, 96],
	[/\bhandstand push[- ]?ups?\b|\bHSPU\b/i, 94],
	[/\brope climbs?\b/i, 92],
	[/\bthrusters?\b/i, 90],
	[/\bdevil'?s? press/i, 88],
	[/\bburpees?\b/i, 86],
	[/\b(assault|echo|air) ?bike\b|\bbike\b/i, 84],
	[/\bsnatch(es)?\b/i, 82],
	[/\bclean\s*(&|and|\+)\s*jerks?\b/i, 80],
	[/\bwall[- ]?balls?\b/i, 78],
	[/\bchest[- ]to[- ]bar\b|\bC2B\b/i, 76],
	[/\boverhead squats?\b|\bOHS\b/i, 75],
	[/\bpistols?\b/i, 74],
	[/\bdouble[- ]?unders?\b|\bDUs?\b/i, 70],
	[/\btoes[- ]to[- ]bar\b|\bT2B\b/i, 68],
	[/\bfront squats?\b/i, 64],
	[/\bdeadlifts?\b/i, 62],
	[/\brow(ing)?\b/i, 60],
	[/\b(run|sprint)\b/i, 58],
	[/\bcleans?\b/i, 57],
	[/\bpull[- ]?ups?\b/i, 56],
	[/\bbox jumps?\b/i, 54],
	[/\b(kb|kettlebell) swings?\b|\bswings?\b/i, 52],
	[/\blunges?\b/i, 46],
	[/\bsquats?\b/i, 40],
	[/\bpush[- ]?ups?\b/i, 38],
	[/\bsit[- ]?ups?\b/i, 30]
];

/**
 * The movement of the main section most likely to hurt, as the coach wrote it but without
 * loads or scaling notes: "Thrusters", "Bar muscle-ups". `null` when nothing is recognised.
 */
export function vaiDoer(wod: Pick<WoD, 'sections'>): string | null {
	const main = mainSection(wod);
	if (!main) return null;

	let best: { score: number; text: string } | null = null;
	for (const line of parseBoard(main.content)) {
		if (line.kind !== 'move') continue;
		const text = line.text || line.qty || '';
		for (const [pattern, score] of NASTY) {
			if (pattern.test(text)) {
				if (!best || score > best.score) best = { score, text };
				break;
			}
		}
	}
	if (!best) return null;

	return (
		best.text
			.replace(/\s*\([^)]*\)/g, '') // loads: "(43/30 kg)"
			.replace(/\s*[@,;].*$/, '') // "@ 70%", ", unbroken"
			.replace(/\s+(or|ou)\s+.*$/i, '') // scaling: "or ring rows"
			.trim() || null
	);
}

// ---------------------------------------------------------------------------
// EMOM slots
// ---------------------------------------------------------------------------

/**
 * For an EMOM written as "Min 1: ... / Min 2: ..." or "Odd: ... / Even: ...", what to do in a
 * given round and what comes after it. `null` when the section is not written that way.
 */
export function emomSlot(
	content: string,
	round: number
): { now: string; next: string | null } | null {
	const numbered: string[] = [];
	let odd: string | null = null;
	let even: string | null = null;

	for (const line of parseBoard(content)) {
		if (line.kind !== 'move' || !line.qty) continue;
		const minute = line.qty.match(/^(?:min|minute)\s?(\d+)$/i);
		if (minute) numbered[Number(minute[1]) - 1] = line.text;
		else if (/^odd$/i.test(line.qty)) odd = line.text;
		else if (/^even$/i.test(line.qty)) even = line.text;
	}

	const slots = numbered.filter((slot) => slot !== undefined);
	if (slots.length >= 2 && slots.length === numbered.length) {
		const at = (r: number) => slots[(r - 1) % slots.length];
		return { now: at(round), next: at(round + 1) };
	}
	if (odd && even) {
		return round % 2 === 1 ? { now: odd, next: even } : { now: even, next: odd };
	}
	return null;
}
