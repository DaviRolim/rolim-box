/** Personal records: the PR board, logging a mark, the photo import and the box leaderboard. */
export const prs = {
	title: 'PRs',
	categories: {
		weightlifting: 'Weightlifting',
		benchmark: 'Benchmarks',
		gymnastics: 'Gymnastics',
		cardio: 'Cardio'
	},
	measurements: { weight: 'Weight', time: 'Time', reps: 'Reps', distance: 'Distance' },
	repsUnit: 'reps',

	page: {
		reading: 'Reading the board',
		logged: (done: number, total: number) => `${done} of ${total} logged`,
		import: 'Import',
		tabsLabel: 'Personal records',
		tabMine: 'My PRs',
		tabLeaderboard: 'Leaderboard',
		loadingPrs: 'Loading PRs',
		loadFailed:
			'The exercise list could not be loaded. It is not saved on this phone yet and the server did not answer.',
		searchLabel: 'Search exercises',
		searchPlaceholder: 'Search: snatch, fran, pull-ups',
		categoryGroup: 'Category',
		recorded: 'Recorded',
		searchResults: 'Search results',
		noMatch: 'No match',
		noMatchBody: 'No exercise is called that.',
		clearSearch: 'Clear search',
		noPrsYet: 'No PRs yet',
		noPrsBody:
			'Pick a category, tap a lift and log your best. It goes straight on the box leaderboard.',
		logFirst: 'Log the first one',
		nothingHere: 'Nothing here',
		emptyCategory: 'There are no exercises in this category.',
		noPrYet: 'No PR yet',
		log: 'Log',
		noBox: 'No box',
		noBoxBody: 'The leaderboard belongs to a box. Join one to see where you stand.',
		saved: 'PR saved!',
		deleted: 'PR deleted',
		imported: 'PRs imported!'
	},

	modal: {
		logNew: 'Log a new PR',
		best: (mark: string) => `Best ${mark}`,
		weightLabel: (unit: string) => `Weight (${unit})`,
		timeLabel: 'Time (mm:ss)',
		repsLabel: 'Reps',
		distanceLabel: (unit: string) => `Distance (${unit})`,
		date: 'Date',
		note: 'Note',
		notePlaceholder: 'Felt strong, belt on, competition day',
		addNote: 'Add a note',
		timeFormatError: 'Write the time as minutes:seconds, for example 5:30.',
		numberError: 'Enter a number above zero.',
		saveFailed: 'This PR could not be saved. Try again.',
		savePr: 'Save PR',
		history: 'History',
		loadingHistory: 'Loading history',
		emptyHistory: 'Nothing logged yet. The first one is always a PR.',
		bestTag: 'Best',
		deleteAria: (date: string) => `Delete the PR of ${date}`,
		inTheBox: 'In the box',
		loadingRanking: 'Loading the ranking',
		/** "You are 03 of 12 on this one." The place is set in bold between the two parts. */
		youAre: 'You are',
		placeOf: (place: string, total: number) => `${place} of ${total}`,
		onThisOne: 'on this one.',
		logToRank: 'Log a PR to get on this board.',
		rankedMore: (n: number) => `${n} ranked · the full list is on the leaderboard`,
		nobodyYet: 'Nobody in the box has logged this one yet. Be the first.',
		rankingOffline: 'The box ranking needs a connection and could not be loaded.',
		deleteTitle: 'Delete this PR?',
		deleteMessage:
			'This entry is removed from your history and from the box ranking. This cannot be undone.',
		deleting: 'Deleting',
		deletePr: 'Delete PR',
		keepIt: 'Keep it'
	},

	import: {
		title: 'Import PRs',
		stepUpload: 'Step 1 of 2 · upload',
		stepReview: 'Step 2 of 2 · review',
		readingImage: 'Reading the image',
		saving: 'Saving',
		pick: 'Pick a screenshot',
		pickBody:
			'A picture of the PR list from another app or a notes page. Drop it here or tap to choose.',
		fileRules: 'PNG, JPG or WEBP · 5 MB max',
		previewAlt: 'The screenshot you picked',
		remove: 'Remove',
		readingTitle: 'Reading your PRs',
		savingTitle: 'Saving your PRs',
		readingBody: 'Matching every line to an exercise. This takes a few seconds.',
		almostThere: 'Almost there.',
		found: (n: number) => `Found ${n} ${n === 1 ? 'PR' : 'PRs'}`,
		selected: (n: number) => `${n} selected`,
		skipped: (n: number) => `${n} skipped`,
		conflicts: (n: number) =>
			n === 1
				? '1 selected line replaces a PR you already have.'
				: `${n} selected lines replace PRs you already have.`,
		checkThis: 'Check this',
		unsure: 'Unsure',
		readAs: (text: string) => `Read as: ${text}`,
		replaces: 'Replaces',
		valueFor: (name: string) => `Value for ${name}`,
		unmatched: (n: number) =>
			n === 1 ? '1 line could not be matched' : `${n} lines could not be matched`,
		readImage: 'Read the image',
		importN: (n: number) => `Import ${n} ${n === 1 ? 'PR' : 'PRs'}`,
		working: 'Working',
		wrongType: 'Pick a PNG, JPG or WEBP image.',
		tooBig: 'The image must be smaller than 5 MB.',
		analyzeFailed: 'The image could not be read. Try again.',
		nothingFound:
			'No PRs found in this image. Make sure it clearly shows exercise names and marks.',
		importFailed: 'The PRs could not be imported. Try again.'
	},

	leaderboard: {
		loading: 'Loading the leaderboard',
		loadFailed: 'The leaderboard could not be loaded.',
		offline: 'The leaderboard needs a connection, and the server cannot be reached right now.',
		rankingFailed: 'That ranking could not be loaded. Try again.',
		rankingOffline: 'That ranking could not be loaded. Check the connection and try again.',
		boxRanking: 'Box ranking',
		athletes: (n: number) => `${n} ${n === 1 ? 'athlete' : 'athletes'}`,
		nobody: 'Nobody is in this box yet.',
		points: (n: number) => (n === 1 ? 'pt' : 'pts'),
		pointsNote: "One point for every exercise where you hold the box's best mark.",
		whoHoldsWhat: 'Who holds what',
		taken: (done: number, total: number) => `${done} of ${total} taken`,
		you: 'You',
		tied: (n: number) => ` +${n} tied`,
		stillOpen: (n: number) => `${n} still open`,
		loadingShort: 'Loading',
		noPrsYet: 'No PRs yet'
	},

	ranking: {
		title: 'Ranking',
		legend: (category: string, measurement: string) => `Ranking · ${category} · ${measurement}`,
		openPodium: 'Open podium',
		openPodiumBody: 'Nobody in the box has logged this one yet. First to log it takes first place.',
		logged: (done: number, total: number) => `${done} of ${total} logged`,
		missing: (n: number) =>
			n === 1
				? '1 athlete has not logged this one yet'
				: `${n} athletes have not logged this one yet`
	},

	rankRow: { you: 'You' },

	/** Messages the PR endpoints send back. */
	savedOffline: 'PR saved on this phone. It goes to the server when you are back online.',
	deletedOffline: 'PR deleted on this phone. The server catches up when you are back online.',

	api: {
		notFound: 'PR not found.',
		exerciseNotFound: 'Exercise not found.',
		someExercisesNotFound: 'Some exercises were not found.',
		importFailed: 'The PRs could not be imported.',
		leaderboardFailed: 'The leaderboard could not be loaded.',
		rankingsFailed: 'The exercise ranking could not be loaded.',
		importNotSetUp: 'Photo import is not set up on this server yet. You can still log PRs by hand.',
		invalidForm: 'The upload could not be read.',
		noImage: 'No image was sent.',
		wrongType: 'Pick a PNG, JPG or WEBP image.',
		tooBig: 'The image must be smaller than 5 MB.',
		analyzeFailed: 'The image could not be read. Try again.',
		importedNote: 'Imported from image'
	}
};
