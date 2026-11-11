import { z } from 'zod';
import { entityIdSchema, sectionSchema, wodDateSchema, type Section } from './wod';

/**
 * The WoD bank: workouts the coaches plan to do one day, with no date yet.
 *
 * A bank WoD has a name (a dated WoD derives its headline from its sections; an idea needs a
 * name to be found again) and may have no sections at all: a name and a rough description are
 * enough to keep an idea. Putting it on a day copies it into a normal WoD.
 */
export interface BankWod {
	id: string;
	workspaceId: string;
	name: string;
	description: string | null;
	/** Same shape as a WoD's sections; `wodId` holds the bank WoD's id. */
	sections: Section[];
	/** The latest date it was put on (YYYY-MM-DD), or null if it never was. */
	lastScheduledOn: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export const BANK_NAME_MAX = 100;
export const BANK_DESCRIPTION_MAX = 500;

const nameSchema = z.string().trim().min(1, 'Name is required').max(BANK_NAME_MAX, 'Name too long');
const descriptionSchema = z.string().max(BANK_DESCRIPTION_MAX, 'Description too long').nullable();

export const createBankWodSchema = z.object({
	id: entityIdSchema.optional(),
	workspaceId: z.string().min(1, 'Workspace ID is required'),
	name: nameSchema,
	description: descriptionSchema,
	sections: z.array(sectionSchema).default([]),
	/** Saving a dated WoD into the bank remembers the day it was on. */
	lastScheduledOn: wodDateSchema.nullable().optional()
});

export const updateBankWodSchema = z.object({
	name: nameSchema.optional(),
	description: descriptionSchema.optional(),
	sections: z.array(sectionSchema).optional()
});

export type CreateBankWodInput = z.infer<typeof createBankWodSchema>;
export type UpdateBankWodInput = z.infer<typeof updateBankWodSchema>;
