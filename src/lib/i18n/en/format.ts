/** How a WoD and its timer are named on the board (see $lib/wod-format.ts). */
export const format = {
	sectionTypes: {
		warmup: 'Warm-up',
		skill: 'Skill',
		wod: 'WoD',
		cooldown: 'Cool-down',
		stretches: 'Stretches',
		custom: 'Extra'
	},
	untitledWod: 'Untitled WoD',
	workout: 'Workout',
	/** "For time · 10 min cap" */
	forTimeLabel: (cap: string) => `For time · ${cap} cap`,
	/** "Every 1:30 × 8" */
	everyLabel: (interval: string, rounds: number) => `Every ${interval} × ${rounds}`,
	forTimeChip: (cap: string) => `For time ${cap}`,
	forTime: 'For time',
	cap: (time: string) => `Cap ${time}`
};
