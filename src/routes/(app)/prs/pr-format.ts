import { formatPRValue, type MeasurementType, type UnitPreference } from '$lib/types/pr';

/**
 * A PR value split into the figure and its unit ("102.5" + "kg", "3:42" + "", "21" + "reps"),
 * so the board can set the figure big and the unit small.
 */
export function prParts(
	value: number,
	measurementType: MeasurementType,
	unit: UnitPreference
): { figure: string; unit: string } {
	const text = formatPRValue(value, measurementType, unit);
	const match = text.match(/^([\d.,:]+)\s*(.*)$/);
	return match ? { figure: match[1], unit: match[2] } : { figure: text, unit: '' };
}

/** "bia@rolimbox.test" -> "bia". The box knows people by first name. */
export function athleteName(email: string): string {
	return email.split('@')[0];
}

export const CATEGORY_LABELS: Record<string, string> = {
	weightlifting: 'Weightlifting',
	benchmark: 'Benchmark',
	gymnastics: 'Gymnastics',
	cardio: 'Cardio'
};

export const MEASUREMENT_LABELS: Record<string, string> = {
	weight: 'Weight',
	time: 'Time',
	reps: 'Reps',
	distance: 'Distance'
};
