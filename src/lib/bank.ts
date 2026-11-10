/**
 * Moving WoDs in and out of the bank. Pure functions, no DOM, no storage.
 */
import { diffDays } from '$lib/date';
import { isGenericName, mainSection } from '$lib/wod-format';
import type { BankWod, CreateBankWodInput } from '$lib/types/bank';
import type { SectionInput, WoD } from '$lib/types/wod';

/**
 * What a bank WoD becomes when it is put on a day: the brief and a copy of every section
 * (fresh ids, so the bank keeps its own).
 *
 * A dated WoD has no name of its own: its headline comes from the main section. So the bank
 * name goes where the headline is read from: onto the main section when that one is called
 * something generic ("WoD", "Metcon"), or as a single section when the bank WoD is still just
 * an idea with no sections.
 */
export function bankToWodInput(bank: Pick<BankWod, 'name' | 'description' | 'sections'>): {
	description: string | null;
	sections: SectionInput[];
} {
	const description = bank.description?.trim() || null;

	if (bank.sections.length === 0) {
		return {
			description,
			sections: [{ type: 'wod', name: bank.name, content: '', order: 0, timerConfig: null }]
		};
	}

	const main = mainSection(bank);
	return {
		description,
		sections: bank.sections.map((s, order) => ({
			type: s.type,
			name: s.id === main?.id && isGenericName(s.name) ? bank.name : s.name,
			content: s.content,
			order,
			timerConfig: s.timerConfig
		}))
	};
}

/** What a dated WoD becomes in the bank: same brief and sections, the day it was on. */
export function wodToBankInput(
	wod: Pick<WoD, 'workspaceId' | 'description' | 'sections' | 'date'>,
	name: string
): CreateBankWodInput {
	return {
		workspaceId: wod.workspaceId,
		name: name.trim(),
		description: wod.description?.trim() || null,
		sections: wod.sections.map((s, order) => ({
			type: s.type,
			name: s.name,
			content: s.content,
			order,
			timerConfig: s.timerConfig
		})),
		lastScheduledOn: wod.date
	};
}

export type BankWhen =
	| { kind: 'never' }
	| { kind: 'today' }
	| { kind: 'past'; date: string; daysAgo: number }
	| { kind: 'next'; date: string };

/** Where a bank WoD stands against the calendar, for "Last on ..." / "Next on ...". */
export function bankWhen(lastScheduledOn: string | null, today: string): BankWhen {
	if (!lastScheduledOn) return { kind: 'never' };
	const days = diffDays(today, lastScheduledOn);
	if (days === 0) return { kind: 'today' };
	if (days > 0) return { kind: 'next', date: lastScheduledOn };
	return { kind: 'past', date: lastScheduledOn, daysAgo: -days };
}

/** The later of two ISO dates (either may be missing). */
export function laterDate(a: string | null, b: string | null): string | null {
	if (!a) return b;
	if (!b) return a;
	return a > b ? a : b;
}
