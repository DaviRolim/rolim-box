/** Words used all over the app. */
export const common = {
	appName: 'RolimBox',
	cancel: 'Cancel',
	confirm: 'Confirm',
	close: 'Close',
	dismiss: 'Dismiss',
	save: 'Save',
	saving: 'Saving',
	delete: 'Delete',
	edit: 'Edit',
	back: 'Back',
	retry: 'Try again',
	loading: 'Loading',
	less: (what: string) => `Less ${what}`,
	more: (what: string) => `More ${what}`,
	roles: { owner: 'Owner', coach: 'Coach', member: 'Athlete' } as Record<string, string>,
	/** "{page} - RolimBox" in the browser tab. */
	pageTitle: (page: string) => `${page} - RolimBox`
};
