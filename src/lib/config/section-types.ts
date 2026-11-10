import type { SectionType } from '$lib/types/wod';
import type { IconName } from '$lib/components/ui/icons';

/** How each kind of section is named on the board and in the editor. */
export const sectionTypes: Record<SectionType, { label: string; icon: IconName }> = {
	warmup: { label: 'Warm-up', icon: 'flame' },
	skill: { label: 'Skill', icon: 'target' },
	wod: { label: 'WoD', icon: 'barbell' },
	cooldown: { label: 'Cool-down', icon: 'wind' },
	stretches: { label: 'Stretches', icon: 'stretch' },
	custom: { label: 'Extra', icon: 'shapes' }
} as const;
