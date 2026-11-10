/** The WoD bank: WoDs the coaches keep for later, with no date, and putting them on a day. */
export const bank = {
	pageTitle: 'WoD bank',
	title: 'Bank',
	switch: { aria: 'WoDs: calendar or bank', calendar: 'Calendar', bank: 'Bank' },
	list: {
		readingBank: 'Reading the bank',
		count: (n: number) => (n === 1 ? '1 WoD in the bank' : `${n} WoDs in the bank`),
		couldNotRefresh: ' · could not refresh',
		newIdea: 'New idea',
		search: 'Search the bank',
		searchPlaceholder: 'Search: sandbag, emom, burpees',
		format: 'Format',
		all: 'All',
		idea: 'Idea',
		loadingAria: 'Loading the bank',
		emptyTitle: 'The bank is empty',
		emptyBody:
			'Keep WoDs here for later, with no date: a name and a rough idea are enough. Put one on a day when its time comes.',
		emptyStale:
			'The server cannot be reached and nothing from the bank is saved on this phone yet.',
		tryAgain: 'Try again',
		firstIdea: 'Save the first idea',
		noMatchTitle: 'No match',
		noMatch: 'Nothing in the bank matches that search.',
		clearSearch: 'Clear search',
		lastOn: (day: string) => `Last on ${day}`,
		nextOn: (day: string) => `Next on ${day}`,
		onToday: 'On the board today',
		never: 'Never on the board',
		schedule: 'Put on a day',
		scheduleAria: (name: string) => `Put ${name} on a day`,
		edit: 'Edit',
		editAria: (name: string) => `Edit ${name}`,
		delete: 'Delete',
		deleteAria: (name: string) => `Delete ${name} from the bank`,
		actionsAria: (name: string) => `Actions for ${name}`,
		pickingFor: (day: string) => `Picking a WoD for ${day}`,
		stopPicking: 'Any day',
		fromBank: 'or pick from the bank'
	},
	editor: {
		pageTitleNew: 'New idea',
		pageTitleEdit: 'Bank WoD',
		newIdea: 'New idea',
		editIdea: 'Bank WoD',
		save: 'Save to bank',
		saveShort: 'Save',
		saveChanges: 'Save changes',
		name: 'Name',
		namePlaceholder: "Sandbag chipper, Danilo's EMOM",
		noDate: 'No date',
		nameRequired: 'Give it a name.',
		nameTooLong: 'The name is too long (100 max).',
		briefPlaceholder: 'The rough idea: movements, loads, what it is for. Sections can come later.',
		sectionsEmpty:
			'No sections yet. A name and the idea are enough to save it; write the sections (or let the Wand) when its day comes.',
		stamp: 'From the bank',
		saved: 'Saved to the bank.',
		updated: 'Bank WoD updated.',
		saveFailed: 'Could not save this to the bank. Nothing was lost: try again.',
		back: 'Back to the bank'
	},
	schedule: {
		title: 'Put on a day',
		day: 'Day',
		nextDays: 'Next days',
		hasWod: 'WoD',
		dayAria: (day: string, taken: boolean) => (taken ? `${day}, already has a WoD` : day),
		alreadyHas: (day: string, titles: string) =>
			`${day} already has ${titles}. This one is added next to it.`,
		copies: (n: number) =>
			`Copies the name, the brief and ${n === 1 ? '1 section' : `${n} sections`}. The bank keeps its own copy for next time.`,
		copiesIdea:
			'It has no sections yet, so the copy opens in the editor for you to finish. The bank keeps the idea.',
		submit: (day: string) => `Put on ${day}`,
		pickDay: 'Pick a day',
		working: 'Putting it on the board',
		cancel: 'Cancel',
		done: (day: string) => `On the board for ${day}.`,
		failed: 'Could not put it on that day. Try again.'
	},
	save: {
		button: 'Save to bank',
		title: 'Save to bank',
		name: 'Name in the bank',
		copies: (n: number, day: string) =>
			`Copies the brief and ${n === 1 ? '1 section' : `${n} sections`}. The WoD on ${day} stays as it is.`,
		submit: 'Save to bank',
		saving: 'Saving',
		cancel: 'Cancel',
		done: (name: string) => `"${name}" is in the bank.`,
		failed: 'Could not save it to the bank. Try again.'
	},
	remove: {
		title: 'Delete from the bank?',
		message: 'Only the bank copy goes. WoDs already put on a day stay on the board.',
		confirm: 'Delete',
		deleting: 'Deleting',
		keep: 'Keep it',
		deleted: (name: string) => `"${name}" deleted from the bank.`,
		failed: 'Could not delete it from the bank.'
	},
	guard: {
		body: (box: string) =>
			`The WoD bank is where the coaches of ${box} keep WoDs for later. You will see them on the board once they are programmed.`,
		notFound: 'Not in the bank',
		notFoundBody: 'It may have been deleted, or it belongs to a box you are not in.',
		notOnPhoneBody: 'This bank WoD is not saved here and the server cannot be reached right now.',
		backToBank: 'Back to the bank'
	},
	api: {
		coachesOnly: 'Only coaches can use the WoD bank.',
		notFound: 'This WoD is not in the bank.',
		alreadyExists: 'This WoD was already saved in the bank.'
	}
};
