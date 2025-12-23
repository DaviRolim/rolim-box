import { z } from 'zod';

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
	timerConfig: string | null; // Reserved for Phase 3 - JSON string of timer configuration
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
 * Section validation schema
 * Used for validating individual sections during create/update operations
 */
export const sectionSchema = z.object({
	type: z.enum(['warmup', 'skill', 'wod', 'cooldown', 'stretches', 'custom']),
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
	workspaceId: z.string().min(1, 'Workspace ID is required'),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
		.refine((date) => {
			const parsed = new Date(date);
			return !isNaN(parsed.getTime());
		}, 'Invalid date'),
	description: z.string().max(500, 'Description too long').nullable(),
	sections: z.array(sectionSchema).default([])
});

/**
 * Update WoD validation schema
 * Used when updating an existing WoD
 * All fields are optional to allow partial updates
 */
export const updateWoDSchema = z.object({
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
		.refine((date) => {
			const parsed = new Date(date);
			return !isNaN(parsed.getTime());
		}, 'Invalid date')
		.optional(),
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
