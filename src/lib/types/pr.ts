import { z } from 'zod';

// ============================================================================
// Type Definitions
// ============================================================================

export type ExerciseCategory = 'weightlifting' | 'benchmark' | 'gymnastics' | 'cardio';
export type MeasurementType = 'weight' | 'time' | 'reps' | 'distance';
export type UnitPreference = 'metric' | 'imperial';

export const EXERCISE_CATEGORIES = ['weightlifting', 'benchmark', 'gymnastics', 'cardio'] as const;
export const MEASUREMENT_TYPES = ['weight', 'time', 'reps', 'distance'] as const;

export interface Exercise {
	id: string;
	name: string;
	category: ExerciseCategory;
	measurementType: MeasurementType;
	sortOrder: number;
}

export interface PersonalRecord {
	id: string;
	userId: string;
	exerciseId: string;
	value: number; // Base units: grams, seconds, count, centimeters
	note: string | null;
	date: string; // YYYY-MM-DD
	createdAt: Date;
	updatedAt: Date;
}

export interface ExerciseWithBestPR extends Exercise {
	bestPR: {
		value: number;
		date: string;
	} | null;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

export const createPRSchema = z.object({
	exerciseId: z.string().min(1, 'Exercise is required'),
	value: z.number().positive('Value must be positive'),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
		.refine((date) => {
			const [year, month, day] = date.split('-').map(Number);
			const parsed = new Date(year, month - 1, day);
			// Check that the date didn't roll over
			return (
				parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
			);
		}, 'Invalid date'),
	note: z.string().max(500, 'Note too long').nullable().optional()
});

export const updateUserSettingsSchema = z.object({
	unitPreference: z.enum(['metric', 'imperial'])
});

// ============================================================================
// Type Inference from Schemas
// ============================================================================

export type CreatePRInput = z.infer<typeof createPRSchema>;
export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;

// ============================================================================
// Unit Conversion Utilities
// ============================================================================

// Storage: grams -> Display: kg or lbs
const GRAMS_PER_KG = 1000;
const GRAMS_PER_LB = 453.592;

// Storage: centimeters -> Display: meters or miles
const CM_PER_METER = 100;
const CM_PER_MILE = 160934;

export function convertWeightForDisplay(grams: number, unit: UnitPreference): number {
	if (unit === 'metric') {
		return Math.round((grams / GRAMS_PER_KG) * 100) / 100; // kg with 2 decimals
	}
	return Math.round((grams / GRAMS_PER_LB) * 100) / 100; // lbs with 2 decimals
}

export function convertWeightForStorage(value: number, unit: UnitPreference): number {
	if (unit === 'metric') {
		return Math.round(value * GRAMS_PER_KG); // kg to grams
	}
	return Math.round(value * GRAMS_PER_LB); // lbs to grams
}

export function convertDistanceForDisplay(cm: number, unit: UnitPreference): number {
	if (unit === 'metric') {
		return Math.round((cm / CM_PER_METER) * 100) / 100; // meters with 2 decimals
	}
	return Math.round((cm / CM_PER_MILE) * 1000) / 1000; // miles with 3 decimals
}

export function convertDistanceForStorage(value: number, unit: UnitPreference): number {
	if (unit === 'metric') {
		return Math.round(value * CM_PER_METER); // meters to cm
	}
	return Math.round(value * CM_PER_MILE); // miles to cm
}

// Time is stored in seconds, no conversion needed
export function formatTime(seconds: number): string {
	if (seconds < 0) seconds = 0; // Guard against negative values
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;

	if (hours > 0) {
		return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parseTime(timeStr: string): number {
	const parts = timeStr.split(':').map(Number);
	if (parts.some((p) => isNaN(p) || p < 0)) {
		return 0; // Return 0 for invalid input
	}
	if (parts.length === 3) {
		return parts[0] * 3600 + parts[1] * 60 + parts[2];
	}
	if (parts.length === 2) {
		return parts[0] * 60 + parts[1];
	}
	return parts[0];
}

export function formatPRValue(
	value: number,
	measurementType: MeasurementType,
	unit: UnitPreference
): string {
	switch (measurementType) {
		case 'weight':
			return `${convertWeightForDisplay(value, unit)}${unit === 'metric' ? 'kg' : 'lbs'}`;
		case 'time':
			return formatTime(value);
		case 'reps':
			return `${value} reps`;
		case 'distance':
			return `${convertDistanceForDisplay(value, unit)}${unit === 'metric' ? 'm' : 'mi'}`;
		default:
			return String(value);
	}
}

export function getWeightUnit(unit: UnitPreference): string {
	return unit === 'metric' ? 'kg' : 'lbs';
}

export function getDistanceUnit(unit: UnitPreference): string {
	return unit === 'metric' ? 'm' : 'mi';
}

// Determine if higher or lower is better for a given measurement type
export function isBetterPR(
	newValue: number,
	oldValue: number,
	measurementType: MeasurementType
): boolean {
	if (measurementType === 'time') {
		return newValue < oldValue; // Lower time is better
	}
	return newValue > oldValue; // Higher weight/reps/distance is better
}
