import type { SectionType } from '$lib/types/wod';

export const sectionTypes: Record<SectionType, { label: string; icon: string; color: string }> = {
	warmup: { label: 'Warmup', icon: '🔥', color: 'orange' },
	skill: { label: 'Skill', icon: '🎯', color: 'blue' },
	wod: { label: 'WoD', icon: '💪', color: 'pink' },
	cooldown: { label: 'Cool-down', icon: '❄️', color: 'cyan' },
	stretches: { label: 'Stretches', icon: '🧘', color: 'purple' },
	custom: { label: 'Custom', icon: '⚙️', color: 'gray' }
} as const;
