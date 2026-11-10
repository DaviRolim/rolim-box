/** Settings, the box's members and invites, and what the sync queue says about itself. */
export const settings = {
	title: 'Settings',
	ground: {
		heading: 'Ground',
		aria: 'Ground (theme)',
		// Sol and Noite are the grounds' names in both languages.
		auto: 'Auto',
		autoHint: 'Follows the phone',
		solHint: 'Light, for a bright box',
		noiteHint: 'Dark',
		note: 'Sol is the light ground: easier to read when the morning sun hits the box.'
	},
	language: {
		heading: 'Language',
		englishHint: 'The default',
		portugueseHint: 'Português do Brasil'
	},
	units: {
		heading: 'Units',
		forPrs: 'For your PRs',
		metric: 'Metric',
		metricHint: 'kg, metres',
		imperial: 'Imperial',
		imperialHint: 'lb, miles',
		nowKg: 'PRs now show in kg.',
		nowLb: 'PRs now show in lb.',
		saveFailed: 'Could not save. This setting needs a connection.'
	},
	sound: {
		heading: 'Clock sound',
		on: 'On',
		off: 'Off',
		toggle: 'Beeps and voice cues',
		note: '3-2-1, "halfway", "ten seconds" and "time". Turn the phone\'s volume up: the music in the box is loud.'
	},
	phone: {
		heading: 'This phone',
		checked: (ago: string) => `Checked ${ago}`,
		notChecked: 'Not checked yet',
		status: {
			offline: 'Offline. Changes are kept on this phone and sent when the signal is back.',
			error: 'The server refused some changes. They need a decision below.',
			unreachable: 'Online, but the server is not answering. It will keep trying.',
			syncing: 'Sending changes to the server.',
			pending: (n: number) =>
				n === 1 ? '1 change is waiting to be sent.' : `${n} changes are waiting to be sent.`,
			synced: 'Everything on this phone is on the server.'
		},
		change: {
			create: { wod: 'New WoD', pr: 'New PR' },
			update: { wod: 'Edit to a WoD', pr: 'Edit to a PR' },
			delete: { wod: 'Delete of a WoD', pr: 'Delete of a PR' }
		},
		syncing: 'Syncing',
		syncNow: 'Sync now',
		discardRefused: 'Discard refused',
		note: 'WoDs and PRs are saved on this phone, so the app opens and the timers run with no signal.',
		upToDate: 'Everything is up to date.',
		stillOffline: 'Still offline. It will sync by itself later.',
		noAnswer: 'The server did not answer. Try again in a moment.',
		discarded: 'Refused changes discarded. The board matches the server again.',
		discardTitle: 'Discard refused changes?',
		discardMessage:
			'The changes the server refused are thrown away and this phone goes back to what the server has. Changes still waiting to be sent are kept.',
		discard: 'Discard',
		keepThem: 'Keep them'
	},
	box: {
		heading: 'Your box',
		membersAndInvites: 'Members and invites'
	},
	account: 'Account',
	sync: {
		notSaved: (reason: string) => `A change could not be saved: ${reason}`,
		unsupported: 'This kind of change is not supported.',
		refusedStatus: (status: number) => `The server refused it (${status}).`,
		notAccepted: 'The server did not accept this change.'
	},
	members: {
		pageTitle: (box: string) => `${box} · Members`,
		onTheBoard: (n: number) => `${n} on the board`,
		invite: {
			heading: 'Invite someone',
			lasts: 'Link lasts 7 days',
			inviteAs: 'Invite as',
			athleteHint: 'Reads WoDs, runs timers, logs PRs',
			coachHint: 'Also programs and edits WoDs',
			creating: 'Creating',
			create: 'Create invite link',
			createFailed: 'Could not create the invite.',
			fresh: 'New invite · send it to them',
			share: 'Share',
			copied: 'Copied',
			copyLink: 'Copy link',
			copyFailed: 'Could not copy. Select the link and copy it by hand.',
			shareTitle: (box: string) => `Join ${box} on RolimBox`
		},
		open: {
			heading: 'Open invites',
			none: 'No invites waiting.',
			until: (role: string, date: string) => `${role} · until ${date}`,
			copyAria: (code: string) => `Copy the link for invite ${code}`,
			cancelAria: (code: string) => `Cancel invite ${code}`,
			cancel: 'Cancel invite'
		},
		list: {
			heading: 'Members',
			since: (date: string) => `Since ${date}`,
			you: ' · you',
			removeAria: (email: string) => `Remove ${email} from the box`,
			remove: 'Remove'
		},
		revoke: {
			done: 'Invite cancelled.',
			failed: 'Could not cancel the invite.',
			title: 'Cancel this invite?',
			message:
				'The link stops working straight away. People who already joined with it stay in the box.',
			cancelling: 'Cancelling',
			keepIt: 'Keep it'
		},
		removal: {
			done: (email: string) => `${email} removed from the box.`,
			failed: 'Could not remove this member.',
			title: 'Remove from the box?',
			message:
				"They lose access to this box's WoDs and leaderboard. Their own PRs are kept on their account.",
			removing: 'Removing',
			keepThem: 'Keep them'
		}
	}
};
