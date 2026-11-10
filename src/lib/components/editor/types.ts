import type { SectionType } from '$lib/types/wod';
import type { TimerConfig } from '$lib/types/timer';

/** A section while it is being edited. `key` becomes the section's id when saved. */
export interface SectionDraft {
	key: string;
	type: SectionType;
	name: string;
	content: string;
	timer: TimerConfig | null;
}
