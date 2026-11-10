// Pure data: the predefined exercise catalogue.
// Kept free of `$lib` / SvelteKit imports so standalone scripts (scripts/seed.ts) can share it.

export type ExerciseCategory = 'weightlifting' | 'benchmark' | 'gymnastics' | 'cardio';
export type MeasurementType = 'weight' | 'time' | 'reps' | 'distance';

export interface ExerciseSeed {
	name: string;
	category: ExerciseCategory;
	measurementType: MeasurementType;
}

export const EXERCISE_SEEDS: ExerciseSeed[] = [
	// Weightlifting
	{ name: 'Back Squat', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Front Squat', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Overhead Squat', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Deadlift', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Clean', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Clean & Jerk', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Snatch', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Power Clean', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Power Snatch', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Push Press', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Push Jerk', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Strict Press', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Bench Press', category: 'weightlifting', measurementType: 'weight' },
	{ name: 'Thruster', category: 'weightlifting', measurementType: 'weight' },
	// Benchmarks
	{ name: 'Fran', category: 'benchmark', measurementType: 'time' },
	{ name: 'Grace', category: 'benchmark', measurementType: 'time' },
	{ name: 'Isabel', category: 'benchmark', measurementType: 'time' },
	{ name: 'Helen', category: 'benchmark', measurementType: 'time' },
	{ name: 'Diane', category: 'benchmark', measurementType: 'time' },
	{ name: 'Elizabeth', category: 'benchmark', measurementType: 'time' },
	{ name: 'Nancy', category: 'benchmark', measurementType: 'time' },
	{ name: 'Annie', category: 'benchmark', measurementType: 'time' },
	{ name: 'Jackie', category: 'benchmark', measurementType: 'time' },
	{ name: 'Karen', category: 'benchmark', measurementType: 'time' },
	{ name: 'Murph', category: 'benchmark', measurementType: 'time' },
	{ name: 'Cindy - 20 min', category: 'benchmark', measurementType: 'reps' },
	{ name: 'Fight Gone Bad', category: 'benchmark', measurementType: 'reps' },
	// Gymnastics
	{ name: 'Max Pull-ups', category: 'gymnastics', measurementType: 'reps' },
	{ name: 'Max Chest-to-Bar', category: 'gymnastics', measurementType: 'reps' },
	{ name: 'Max Muscle-ups', category: 'gymnastics', measurementType: 'reps' },
	{ name: 'Max Ring Muscle-ups', category: 'gymnastics', measurementType: 'reps' },
	{ name: 'Max Handstand Push-ups', category: 'gymnastics', measurementType: 'reps' },
	{ name: 'Max Toes-to-Bar', category: 'gymnastics', measurementType: 'reps' },
	{ name: 'Max Double-unders', category: 'gymnastics', measurementType: 'reps' },
	// Cardio
	{ name: '400m Run', category: 'cardio', measurementType: 'time' },
	{ name: '800m Run', category: 'cardio', measurementType: 'time' },
	{ name: '1 Mile Run', category: 'cardio', measurementType: 'time' },
	{ name: '5K Run', category: 'cardio', measurementType: 'time' },
	{ name: '500m Row', category: 'cardio', measurementType: 'time' },
	{ name: '2K Row', category: 'cardio', measurementType: 'time' },
	{ name: '1K Bike Erg', category: 'cardio', measurementType: 'time' },
	{ name: '5K Bike Erg', category: 'cardio', measurementType: 'time' }
];

export const CATEGORY_SORT_BASE: Record<ExerciseCategory, number> = {
	weightlifting: 0,
	benchmark: 100,
	gymnastics: 200,
	cardio: 300
};

/** Sort order used when inserting the catalogue (category base + position in the list). */
export function exerciseSortOrder(seed: ExerciseSeed, index: number): number {
	return CATEGORY_SORT_BASE[seed.category] + index;
}
