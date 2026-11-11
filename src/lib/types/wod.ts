import { z } from 'zod';
import { isIsoDate } from '$lib/date';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Section type union - defines the different types of workout sections
 */
export type SectionType = 'warmup' | 'skill' | 'wod' | 'cooldown' | 'stretches' | 'custom';

/**
 * Section types constant array for UI use (dropdowns, iteration, etc.)
 */
export const SECTION_TYPES = ['warmup', 'skill', 'wod', 'cooldown', 'stretches', 'custom'] as const;

/**
 * Section interface - represents a single section within a WoD
 */
export interface Section {
	id: string;
	wodId: string;
	type: SectionType;
	name: string;
	content: string;
	order: number;
	timerConfig: string | null; // JSON string of a TimerConfig, or null when the section has no timer
}

/**
 * WoD (Workout of the Day) interface
 */
export interface WoD {
	id: string;
	workspaceId: string;
	date: string; // YYYY-MM-DD format
	description: string | null;
	sections: Section[];
	createdAt: Date;
	updatedAt: Date;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * IDs are generated on the device (32 hex chars) so a WoD created offline keeps the same id,
 * and the same timer links, once it reaches the server.
 */
export const entityIdSchema = z.string().regex(/^[0-9a-f]{32}$/, 'Invalid id');

export const wodDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
	.refine(isIsoDate, 'Invalid date');

/**
 * Section validation schema
 * Used for validating individual sections during create/update operations
 */
export const sectionSchema = z.object({
	id: entityIdSchema.optional(),
	type: z.enum(SECTION_TYPES),
	name: z.string().min(1, 'Section name is required').max(100, 'Section name too long'),
	content: z.string().max(2000, 'Section content too long'),
	order: z.number().int().min(0, 'Order must be a non-negative integer'),
	timerConfig: z.string().nullable().optional()
});

/**
 * Create WoD validation schema
 * Used when creating a new WoD
 */
export const createWoDSchema = z.object({
	id: entityIdSchema.optional(),
	workspaceId: z.string().min(1, 'Workspace ID is required'),
	date: wodDateSchema,
	description: z.string().max(500, 'Description too long').nullable(),
	sections: z.array(sectionSchema).default([]),
	/** Set when the WoD is a copy of a bank WoD being put on a day: the bank entry records it. */
	bankWodId: entityIdSchema.optional()
});

/**
 * Update WoD validation schema
 * Used when updating an existing WoD
 * All fields are optional to allow partial updates
 */
export const updateWoDSchema = z.object({
	date: wodDateSchema.optional(),
	description: z.string().max(500, 'Description too long').nullable().optional(),
	sections: z.array(sectionSchema).optional()
});

// ============================================================================
// Type Inference from Schemas
// ============================================================================

/**
 * Inferred types from Zod schemas for use in function signatures
 */
export type CreateWoDInput = z.infer<typeof createWoDSchema>;
export type UpdateWoDInput = z.infer<typeof updateWoDSchema>;
export type SectionInput = z.infer<typeof sectionSchema>;
