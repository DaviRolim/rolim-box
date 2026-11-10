/** Relative words around dates. Day and month names come from Intl. */
export const date = {
	today: 'Today',
	tomorrow: 'Tomorrow',
	yesterday: 'Yesterday',
	thisWeek: 'This week',
	lastWeek: 'Last week',
	nextWeek: 'Next week',
	justNow: 'just now',
	minutesAgo: (n: number) => `${n} min ago`,
	hoursAgo: (n: number) => `${n} h ago`,
	daysAgo: (n: number) => `${n} d ago`
};
