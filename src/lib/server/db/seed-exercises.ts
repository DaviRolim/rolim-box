import { db } from '$lib/server/db';
import { exercise } from '$lib/server/db/schema';
import { generateId } from '$lib/server/auth';

type ExerciseCategory = 'weightlifting' | 'benchmark' | 'gymnastics' | 'cardio';
type MeasurementType = 'weight' | 'time' | 'reps' | 'distance';

interface ExerciseSeed {
	name: string;
	category: ExerciseCategory;
	measurementType: MeasurementType;
}

const exercises: ExerciseSeed[] = [
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

export async function seedExercises(): Promise<void> {
	// Check if exercises already exist
	const existing = await db.select().from(exercise).limit(1);
	if (existing.length > 0) {
		return;
	}

	const categoryOrder: Record<ExerciseCategory, number> = {
		weightlifting: 0,
		benchmark: 100,
		gymnastics: 200,
		cardio: 300
	};

	const values = exercises.map((ex, index) => ({
		id: generateId(),
		name: ex.name,
		category: ex.category,
		measurementType: ex.measurementType,
		sortOrder: categoryOrder[ex.category] + index
	}));

	await db.insert(exercise).values(values);
	console.log(`Seeded ${values.length} exercises`);
}
