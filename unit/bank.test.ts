import { describe, expect, test } from 'bun:test';
import { bankToWodInput, bankWhen, laterDate, wodToBankInput } from '$lib/bank';
import { mainMovements } from '$lib/wod-format';
import type { Section, WoD } from '$lib/types/wod';

function section(partial: Partial<Section>): Section {
	return {
		id: partial.id ?? Math.random().toString(16).slice(2),
		wodId: 'b',
		type: 'wod',
		name: 'WoD',
		content: '',
		order: 0,
		timerConfig: null,
		...partial
	};
}

describe('bankToWodInput', () => {
	test('an idea with no sections becomes one section carrying its name', () => {
		const input = bankToWodInput({
			name: 'Sandbag chipper',
			description: '  Partner chipper with sandbags.  ',
			sections: []
		});
		expect(input.description).toBe('Partner chipper with sandbags.');
		expect(input.sections).toEqual([
			{ type: 'wod', name: 'Sandbag chipper', content: '', order: 0, timerConfig: null }
		]);
	});

	test('a generic main section takes the bank name; the others are copied as they are', () => {
		const timer = JSON.stringify({ type: 'emom', rounds: 24, intervalWork: 60 });
		const input = bankToWodInput({
			name: "Danilo's EMOM",
			description: null,
			sections: [
				section({ id: 'w1', type: 'warmup', name: 'Warm-up', content: '400m run' }),
				section({ id: 'm', type: 'wod', name: 'Metcon', content: 'Min 1: row', timerConfig: timer })
			]
		});
		expect(input.description).toBeNull();
		expect(input.sections.map((s) => s.name)).toEqual(['Warm-up', "Danilo's EMOM"]);
		expect(input.sections[1].timerConfig).toBe(timer);
		expect(input.sections.map((s) => s.order)).toEqual([0, 1]);
		// Fresh ids on the server: the bank keeps its own sections.
		expect(input.sections.every((s) => s.id === undefined)).toBe(true);
	});

	test('a main section with a real name keeps it', () => {
		const input = bankToWodInput({
			name: 'Benchmark Friday',
			description: null,
			sections: [section({ name: 'Fran' })]
		});
		expect(input.sections[0].name).toBe('Fran');
	});
});

describe('wodToBankInput', () => {
	test('copies the brief and sections and remembers the day it was on', () => {
		const wod: WoD = {
			id: 'w',
			workspaceId: 'ws',
			date: '2026-11-10',
			description: 'Benchmark day.',
			sections: [section({ id: 's1', name: 'Fran', content: '21-15-9' })],
			createdAt: new Date(),
			updatedAt: new Date()
		};
		const input = wodToBankInput(wod, '  Fran  ');
		expect(input).toMatchObject({
			workspaceId: 'ws',
			name: 'Fran',
			description: 'Benchmark day.',
			lastScheduledOn: '2026-11-10'
		});
		expect(input.sections).toEqual([
			{ type: 'wod', name: 'Fran', content: '21-15-9', order: 0, timerConfig: null }
		]);
	});
});

describe('bankWhen', () => {
	const today = '2026-11-10';
	test('never, today, past and next', () => {
		expect(bankWhen(null, today)).toEqual({ kind: 'never' });
		expect(bankWhen(today, today)).toEqual({ kind: 'today' });
		expect(bankWhen('2026-11-03', today)).toEqual({
			kind: 'past',
			date: '2026-11-03',
			daysAgo: 7
		});
		expect(bankWhen('2026-11-12', today)).toEqual({ kind: 'next', date: '2026-11-12' });
	});

	test('laterDate keeps the latest of two dates', () => {
		expect(laterDate(null, '2026-11-01')).toBe('2026-11-01');
		expect(laterDate('2026-11-05', null)).toBe('2026-11-05');
		expect(laterDate('2026-11-05', '2026-11-01')).toBe('2026-11-05');
		expect(laterDate(null, null)).toBeNull();
	});
});

describe('mainMovements', () => {
	test('lists the movements of the main section without reps, loads or scaling', () => {
		const wod = {
			sections: [
				section({ type: 'warmup', name: 'Warm-up', content: '400m run' }),
				section({
					content:
						'21-15-9 for time:\nThrusters (43/30 kg)\nPull-ups or ring rows\n\nTime cap: 10 min'
				})
			]
		};
		expect(mainMovements(wod)).toEqual(['Thrusters', 'Pull-ups']);
	});

	test('EMOM slots give the movement, not the count', () => {
		const wod = {
			sections: [
				section({
					content:
						'Every minute for 24 min:\nMin 1: 15/12 cal row\nMin 2: 8 toes-to-bar\nMin 3: 10 dumbbell snatches (22,5/15 kg)\nMin 4: 30s handstand hold'
				})
			]
		};
		expect(mainMovements(wod)).toEqual(['Row', 'Toes-to-bar', 'Dumbbell snatches']);
		expect(mainMovements(wod, 5)).toHaveLength(4);
	});

	test('no sections, no movements', () => {
		expect(mainMovements({ sections: [] })).toEqual([]);
	});
});
