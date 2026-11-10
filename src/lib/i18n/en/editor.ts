/** The coach's bench: new / edit WoD, sections, the clock fields and the Magic Wand. */
export const editor = {
	pageTitleNew: 'New WoD',
	pageTitleEdit: 'Edit WoD',
	newWod: 'New WoD',
	editWod: 'Edit WoD',
	status: { saving: 'Saving', unsaved: 'Unsaved', blank: 'Blank', saved: 'Saved' },
	saveWod: 'Save WoD',
	/** The header button of a new WoD, next to its heading (short: the phone has no room). */
	saveWodShort: 'Save WoD',
	save: 'Save',
	saveChanges: 'Save changes',
	saving: 'Saving',
	cancel: 'Cancel',
	back: 'Back',
	viewSwitch: 'Editor view',
	tabEdit: 'Edit',
	tabPreview: 'Preview',
	when: 'When',
	date: 'Date',
	today: 'Today',
	tomorrow: 'Tomorrow',
	sameDay: (date: string, titles: string[]) =>
		`${date} already has ${titles.map((title) => `"${title}"`).join(' and ')}. Saving adds a second WoD to that day.`,
	brief: {
		label: "Coach's brief",
		placeholder: "What is today about? Athletes read this under the WoD's name."
	},
	errors: {
		pickDate: 'Pick a date.',
		briefTooLong: 'The brief is too long (500 characters max).',
		noSections: 'Add at least one section.',
		sectionsNeedName: 'Some sections need a name.',
		nameRequired: 'Give this section a name.',
		nameTooLong: 'Name is too long (100 max).',
		contentTooLong: 'Too long (2000 characters max).'
	},
	wand: {
		button: 'Magic Wand',
		drafting: 'Drafting',
		draftingAria: 'The Magic Wand is drafting',
		helpEmpty: 'Write a line or two and the Wand drafts the sections for you.',
		helpReady: 'Drafts the sections from the brief. You can edit or undo everything.',
		off: 'The Magic Wand is not set up on this server (it needs an OPENROUTER_API_KEY). Everything else works: add the sections by hand below.',
		offline: 'The Magic Wand needs a connection. You are offline.',
		failed: 'The Magic Wand could not draft this one. Try again.',
		empty: 'The Wand came back empty. Add more detail to the brief.',
		unreachable: 'Could not reach the server. Check the connection and try again.',
		drafted: (n: number) =>
			`The Wand drafted ${n} ${n === 1 ? 'section' : 'sections'}. Check the loads and fix anything that is off.`,
		undo: 'Undo'
	},
	toast: {
		savedOffline: 'Saved on this phone. It goes to the server when you are back online.',
		updated: 'WoD updated.',
		savedFor: (date: string) => `WoD saved for ${date}.`,
		saveFailed: 'Could not save this WoD. Nothing was lost: try again.'
	},
	sections: {
		heading: 'Sections',
		parts: (n: number) => `${n} ${n === 1 ? 'part' : 'parts'}`,
		removed: (name: string) => `Removed "${name}".`,
		section: 'section',
		undo: 'Undo',
		empty: 'No sections yet. Start with the warm-up, or go straight to the WoD.',
		add: 'Add section',
		or: 'or',
		addTypeAria: (type: string) => `Add a ${type} section`,
		shortcuts: '⌘S save · ⌘↵ add section · ⌥↑ ⌥↓ move the section you are in'
	},
	preview: {
		aria: 'Preview',
		heading: 'What athletes see',
		live: 'Live',
		empty: 'The board fills in as you write.'
	},
	leave: {
		title: 'Leave without saving?',
		message: 'The changes you made to this WoD have not been saved.',
		confirm: 'Discard changes',
		cancel: 'Keep editing'
	},
	section: {
		legend: (n: number, name: string) => `Section ${n}: ${name}`,
		unnamed: 'unnamed',
		section: 'section',
		typeLabel: (n: number) => `Type of section ${n}`,
		moveUpAria: (name: string) => `Move ${name} up`,
		moveUpTitle: 'Move up (Alt+↑)',
		moveDownAria: (name: string) => `Move ${name} down`,
		moveDownTitle: 'Move down (Alt+↓)',
		removeAria: (name: string) => `Remove ${name}`,
		removeTitle: 'Remove section',
		name: 'Name',
		namePlaceholder: 'Fran, Strength, Warm-up',
		content: "What's on the board",
		contentHint: '· one movement per line',
		example: '21-15-9 for time:\nThrusters (43/30 kg)\nPull-ups\n\nTime cap: 10 min'
	},
	timer: {
		legend: 'Clock',
		formatAria: 'Clock format',
		none: 'No clock',
		capMin: 'Cap (min)',
		minutes: 'Minutes',
		rounds: 'Rounds',
		every: 'Every (s)',
		work: 'Work (s)',
		rest: 'Rest (s)',
		total: (time: string) => `Total ${time}`
	},
	guard: {
		coachesOnly: 'Coaches only',
		title: 'Not your whiteboard',
		thisBox: 'this box',
		cannotProgram: (box: string) =>
			`Only the coaches of ${box} can program WoDs. You can still read every one of them.`,
		cannotChange: (box: string) => `Only the coaches of ${box} can change a WoD.`,
		backToToday: 'Back to today',
		backToWod: 'Back to the WoD',
		loading: 'Loading',
		loadingWod: 'Loading the WoD',
		offline: 'Offline',
		notOnPhone: 'Not on this phone',
		notOnPhoneBody: 'This WoD is not saved here and the server cannot be reached right now.',
		allWods: 'All WoDs',
		notFound: 'WoD not found',
		notFoundBody: 'It may have been deleted, or it belongs to a box you are not in.'
	},
	api: {
		wodNotFound: 'WoD not found.',
		workspaceRequired: 'Pick a box first.',
		membersCannotCreate: 'Only coaches can program WoDs.',
		membersCannotEdit: 'Only coaches can change WoDs.',
		membersCannotDelete: 'Only coaches can delete WoDs.',
		membersCannotDuplicate: 'Only coaches can copy WoDs.',
		alreadyExists: 'This WoD was already saved.',
		coachesOnlyWand: 'Only coaches can use the Magic Wand.',
		wandNotConfigured:
			'The Magic Wand is not set up on this server yet. You can still add sections by hand.',
		wandNoSections: 'Could not draft sections from this description. Try adding more detail.',
		wandKeyRejected: 'The Magic Wand key was rejected. Check OPENROUTER_API_KEY on the server.',
		rateLimited: 'Too many requests. Wait a moment and try again.',
		wandFailed: 'The Magic Wand could not draft this one. Try again.'
	}
};
