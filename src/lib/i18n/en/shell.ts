/** The frame around every screen: navigation, sync lamp, language switch, box switcher. */
export const shell = {
	nav: { today: 'Today', wods: 'WoDs', clock: 'Clock', prs: 'PRs' },
	mainNav: 'Main',
	homeLink: 'RolimBox, today',
	newWod: 'New WoD',
	settings: 'Settings',
	logOut: 'Log out',
	offlineStrip: 'Offline. Showing what is saved on this phone.',
	refused: (n: number) =>
		n === 1 ? '1 change was refused by the server.' : `${n} changes were refused by the server.`,
	review: 'Review',
	language: 'Language',
	languageNames: { en: 'English', pt: 'Português' },
	sync: {
		offline: 'Offline',
		refused: (n: number) => `${n} refused`,
		unreachable: 'No server',
		syncing: 'Sending',
		pending: (n: number) => `${n} to send`,
		synced: 'Synced',
		aria: (label: string) => `Sync status: ${label}. Open settings.`
	},
	box: {
		label: 'Box',
		switchAria: (name: string) => `Box: ${name}. Switch box.`,
		switchTitle: 'Switch box',
		youTrainIn: (n: number) => `You train in ${n} boxes`,
		switching: 'Switching',
		switchFailed: 'Could not switch box. Check your connection and try again.'
	}
};
