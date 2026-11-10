import {
	formatPRValue,
	type ExerciseCategory,
	type MeasurementType,
	type UnitPreference
} from '$lib/types/pr';
import { t } from '$lib/i18n';

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

/** Category and measurement names in the active language (read at render time). */
export function categoryLabel(category: ExerciseCategory): string {
	return t.prs.categories[category] ?? category;
}

export function measurementLabel(measurementType: MeasurementType): string {
	return t.prs.measurements[measurementType] ?? measurementType;
}
