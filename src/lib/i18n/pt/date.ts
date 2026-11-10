import type { Dict } from '../en';

export const date: Dict['date'] = {
	today: 'Hoje',
	tomorrow: 'Amanhã',
	yesterday: 'Ontem',
	thisWeek: 'Esta semana',
	lastWeek: 'Semana passada',
	nextWeek: 'Semana que vem',
	justNow: 'agora há pouco',
	minutesAgo: (n) => `há ${n} min`,
	hoursAgo: (n) => `há ${n} h`,
	daysAgo: (n) => (n === 1 ? 'há 1 dia' : `há ${n} dias`)
};
