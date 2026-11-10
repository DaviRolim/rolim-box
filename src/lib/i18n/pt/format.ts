import type { Dict } from '../en';

export const format: Dict['format'] = {
	sectionTypes: {
		warmup: 'Aquecimento',
		skill: 'Skill',
		wod: 'WoD',
		cooldown: 'Desaquecimento',
		stretches: 'Alongamento',
		custom: 'Extra'
	},
	untitledWod: 'WoD sem nome',
	workout: 'Treino',
	forTimeLabel: (cap) => `For time · cap ${cap}`,
	everyLabel: (interval, rounds) => `A cada ${interval} × ${rounds}`,
	forTimeChip: (cap) => `For time ${cap}`,
	forTime: 'For time',
	cap: (time) => `Cap ${time}`
};
