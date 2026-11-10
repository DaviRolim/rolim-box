import { describe, expect, test } from 'bun:test';
import {
	clock,
	emomSlot,
	formatStrip,
	mainSection,
	parseBoard,
	timerChip,
	vaiDoer,
	wodTitle
} from '$lib/wod-format';
import type { Section, WoD } from '$lib/types/wod';

function section(partial: Partial<Section>): Section {
	return {
		id: partial.id ?? Math.random().toString(16).slice(2),
		wodId: 'w',
		type: 'wod',
		name: 'WoD',
		content: '',
		order: 0,
		timerConfig: null,
		...partial
	};
}

function wod(sections: Section[], description: string | null = null): WoD {
	return {
		id: 'w',
		workspaceId: 'ws',
		date: '2026-11-10',
		description,
		sections,
		createdAt: new Date(),
		updatedAt: new Date()
	};
}

const fran = wod([
	section({ type: 'warmup', name: 'Warm-up', content: '2 rounds:\n200m run\n10 air squats' }),
	section({
		type: 'wod',
		name: 'Fran',
		content: '21-15-9 for time:\nThrusters (43/30 kg)\nPull-ups\n\nTime cap: 10 min',
		timerConfig: JSON.stringify({ type: 'fortime', duration: 600 })
	})
]);

describe('parseBoard', () => {
	test('pulls the rep count out of a movement line', () => {
		expect(parseBoard('21 thrusters')).toEqual([{ kind: 'move', qty: '21', text: 'thrusters' }]);
		expect(parseBoard('400m run')).toEqual([{ kind: 'move', qty: '400m', text: 'run' }]);
		expect(parseBoard('15/12 cal row')[0]).toEqual({ kind: 'move', qty: '15/12 cal', text: 'row' });
	});

	test('treats a line ending in a colon as a heading and a cap as a note', () => {
		const lines = parseBoard('21-15-9 for time:\nThrusters (43/30 kg)\n\nTime cap: 10 min');
		expect(lines.map((l) => l.kind)).toEqual(['heading', 'move', 'gap', 'note']);
		expect(lines[0]).toEqual({ kind: 'heading', text: '21-15-9 for time' });
		expect(lines[1]).toEqual({ kind: 'move', qty: null, text: 'Thrusters (43/30 kg)' });
	});

	test('keeps every line of the coach, in order', () => {
		const text = 'Min 1: 15 cal row\nMin 2: 12 toes-to-bar\n- 10 burpees\nGo hard.';
		const lines = parseBoard(text).filter((l) => l.kind !== 'gap');
		expect(lines).toHaveLength(4);
		expect(lines[0]).toEqual({ kind: 'move', qty: 'Min 1', text: '15 cal row' });
		expect(lines[2]).toEqual({ kind: 'move', qty: '10', text: 'burpees' });
	});

	test('drops trailing blank lines and collapses repeated ones', () => {
		expect(parseBoard('10 push-ups\n\n\n\n5 pull-ups\n\n').map((l) => l.kind)).toEqual([
			'move',
			'gap',
			'move'
		]);
	});
});

describe('headline', () => {
	test('the main section is the one typed "wod"', () => {
		expect(mainSection(fran)?.name).toBe('Fran');
	});

	test('a named WoD keeps its name; a generic one is named after its clock', () => {
		expect(wodTitle(fran)).toBe('Fran');
		const generic = wod([
			section({ name: 'WoD', timerConfig: JSON.stringify({ type: 'amrap', duration: 720 }) })
		]);
		expect(wodTitle(generic)).toBe('AMRAP 12′');
	});

	test('a WoD with nothing in it still gets a title', () => {
		expect(wodTitle(wod([]))).toBe('Untitled WoD');
		expect(wodTitle(wod([], 'Rest day. Go for a swim.'))).toBe('Rest day.');
	});
});

describe('clock formats', () => {
	test('clock', () => {
		expect(clock(90)).toBe('1:30');
		expect(clock(600)).toBe('10:00');
	});

	test('the strip under the name', () => {
		expect(formatStrip({ type: 'fortime', duration: 600 })).toEqual(['For time', 'Cap 10:00']);
		expect(formatStrip({ type: 'amrap', duration: 1200 })).toEqual(['AMRAP', '20:00']);
		expect(formatStrip({ type: 'emom', rounds: 8, intervalWork: 60 })).toEqual(['EMOM', '8 min']);
		expect(formatStrip({ type: 'emom', rounds: 5, intervalWork: 120 })).toEqual([
			'EMOM',
			'5 × 2:00'
		]);
		expect(formatStrip({ type: 'tabata', rounds: 8, intervalWork: 20, intervalRest: 10 })).toEqual([
			'Tabata',
			'8 × 20s / 10s'
		]);
	});

	test('the chip in lists', () => {
		expect(timerChip({ type: 'fortime', duration: 600 })).toBe('For time 10′');
		expect(timerChip({ type: 'emom', rounds: 24, intervalWork: 60 })).toBe('EMOM 24′');
	});
});

describe('vaiDoer', () => {
	test('names the nastiest movement of the main section, without the load', () => {
		expect(vaiDoer(fran)).toBe('Thrusters');
	});

	test('ranks muscle-ups above everything and strips scaling options', () => {
		const nasty = wod([
			section({ content: '10 wall balls\n5 bar muscle-ups or 10 pull-ups\n200m run' })
		]);
		expect(vaiDoer(nasty)).toBe('bar muscle-ups');
	});

	test('says nothing when it recognises nothing', () => {
		expect(vaiDoer(wod([section({ content: 'Mobility flow\nBreathe' })]))).toBeNull();
		expect(vaiDoer(wod([]))).toBeNull();
	});
});

describe('emomSlot', () => {
	const numbered = 'Min 1: 15 cal row\nMin 2: 12 toes-to-bar\nMin 3: 9 burpees';

	test('cycles through numbered minutes', () => {
		expect(emomSlot(numbered, 1)).toEqual({ now: '15 cal row', next: '12 toes-to-bar' });
		expect(emomSlot(numbered, 3)).toEqual({ now: '9 burpees', next: '15 cal row' });
		expect(emomSlot(numbered, 5)?.now).toBe('12 toes-to-bar');
	});

	test('alternates odd and even', () => {
		const text = 'Odd: 6 handstand push-ups\nEven: 12 pistols';
		expect(emomSlot(text, 1)?.now).toBe('6 handstand push-ups');
		expect(emomSlot(text, 4)?.now).toBe('12 pistols');
	});

	test('is null for an EMOM that is not written in slots', () => {
		expect(emomSlot('3 thrusters\nBuild to your Fran weight.', 2)).toBeNull();
	});
});
