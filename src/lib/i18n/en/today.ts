/** Today, the WoD list, a single WoD and the pieces they share (poster, placar, duplicate). */
export const today = {
	dashboard: {
		title: 'Today',
		inDays: (n: number) => (n === 1 ? 'In 1 day' : `In ${n} days`),
		daysAgo: (n: number) => (n === 1 ? '1 day ago' : `${n} days ago`),
		backToToday: 'Back to today',
		loadingAria: 'Loading the WoD',
		readingBoard: 'Reading the board',
		wodsOnDay: 'WoDs on this day',
		edit: 'Edit',
		duplicate: 'Duplicate',
		offline: 'Offline',
		noAnswer: 'No answer from the server',
		blankTitle: 'The board is blank',
		blankBody:
			'This phone has not saved any WoDs yet and the server cannot be reached. Connect once and everything will be here next time, signal or not.',
		trying: 'Trying',
		tryAgain: 'Try again',
		emptyTitle: 'Nothing on the board',
		noneProgrammed: (day: string) => `No WoD is programmed for ${day}.`,
		noneWas: (day: string) => `There was no WoD on ${day}.`,
		notPostedToday:
			"The coaches have not posted today's WoD yet. It shows up here the moment they do.",
		notPostedDay: (day: string) =>
			`The coaches have not posted a WoD for ${day} yet. It shows up here the moment they do.`,
		programToday: 'Program today',
		programDay: (day: string) => `Program ${day}`,
		nextUp: (day: string, title: string) => `Next up: ${day} · ${title}`
	},
	view: {
		placarMode: 'Placar mode',
		runningOrder: 'Running order',
		parts: (n: number) => (n === 1 ? '1 part' : `${n} parts`),
		noSections: 'This WoD has no sections yet.'
	},
	poster: {
		format: (a: string, b: string) => `Format: ${a}, ${b}`,
		fromCoach: 'From the coach'
	},
	section: {
		startClock: 'Start clock'
	},
	placar: {
		dialog: (name: string) => `Placar mode: ${name}`,
		close: 'Close placar mode',
		previous: 'Previous section',
		next: 'Next section',
		startClock: 'Start clock',
		noClock: 'No clock for this part'
	},
	week: {
		pickDay: 'Pick a day',
		previousWeek: 'Previous week',
		nextWeek: 'Next week',
		todaySuffix: ', today',
		hasWod: ', has a WoD',
		nothing: ', nothing programmed'
	},
	duplicate: {
		title: 'Duplicate',
		copyTo: 'Copy to',
		today: 'Today',
		tomorrow: 'Tomorrow',
		sameDayNextWeek: 'Same day next week',
		copied: (day: string) => `Copied to ${day}.`,
		failed: 'Could not duplicate this WoD.',
		alreadyHas: (day: string, n: number, titles: string) =>
			`${day} already has ${n === 1 ? 'a WoD' : `${n} WoDs`} (${titles}). The copy is added next to it.`,
		copying: 'Copying',
		submit: 'Duplicate WoD',
		cancel: 'Cancel'
	},
	list: {
		title: 'WoDs',
		readingBoard: 'Reading the board',
		onBoard: (n: number) => `${n} on the board`,
		couldNotRefresh: ' · could not refresh',
		newWod: 'New WoD',
		search: 'Search WoDs',
		searchPlaceholder: 'Search: fran, thrusters, emom',
		format: 'Format',
		all: 'All',
		loadingAria: 'Loading WoDs',
		emptyTitle: 'No WoDs yet',
		emptyStale: 'The server cannot be reached and nothing is saved on this phone yet.',
		emptyCoach:
			"This box has an empty board. Program the first one and it shows up on everyone's phone.",
		emptyAthlete: 'The coaches have not programmed anything in this box yet.',
		tryAgain: 'Try again',
		programFirst: 'Program the first WoD',
		noMatchTitle: 'No match',
		noMatch: 'Nothing on the board matches that search.',
		clearSearch: 'Clear search',
		duplicate: 'Duplicate',
		edit: 'Edit',
		delete: 'Delete',
		duplicateAria: (title: string, day: string) => `Duplicate ${title}, ${day}`,
		editAria: (title: string, day: string) => `Edit ${title}, ${day}`,
		deleteAria: (title: string, day: string) => `Delete ${title}, ${day}`,
		actionsAria: (title: string, day: string) => `Actions for ${title}, ${day}`,
		programToday: 'Program today',
		programDay: (weekday: string) => `Program ${weekday}`,
		nothingYet: '· nothing on the board yet',
		showOlder: (n: number) => `Show older WoDs (${n} more)`
	},
	detail: {
		allWods: 'All WoDs',
		today: 'Today',
		edit: 'Edit',
		duplicate: 'Duplicate',
		delete: 'Delete',
		deleteAria: 'Delete this WoD',
		loadingAria: 'Loading the WoD',
		offline: 'Offline',
		notHereTitle: 'Not on this phone',
		notHereBody:
			'This WoD is not saved here and the server cannot be reached right now. It will open as soon as there is a connection.',
		backToToday: 'Back to today',
		notFoundTitle: 'WoD not found',
		notFoundBody: 'It may have been deleted, or it belongs to a box you are not in.'
	},
	remove: {
		title: 'Delete this WoD?',
		message: "It disappears from everyone's board. This cannot be undone.",
		deleting: 'Deleting',
		confirm: 'Delete WoD',
		keep: 'Keep it',
		deleted: (title: string) => `"${title}" deleted.`,
		failed: 'Could not delete this WoD.'
	}
};
