/** The front door (login, register, invites), the error page and "no box yet". */
export const auth = {
	email: 'Email',
	password: 'Password',
	passwordHelp: 'At least 8 characters.',
	alreadyHaveAccount: 'Already have an account?',
	logIn: 'Log in',
	/** Form errors come back from the server as codes and are worded here. */
	errors: {
		invalid_email: 'Invalid email address',
		password_required: 'Password is required',
		password_short: 'Password must be at least 8 characters',
		bad_credentials: 'Invalid email or password',
		email_taken: 'Email already registered',
		email_taken_login: 'Email already registered. Please log in instead.',
		invite_invalid: 'Invalid or expired invite'
	} as Record<string, string>,
	login: {
		title: 'Log in',
		eyebrow: "Members' entrance",
		opening: 'Opening the door',
		newHere: 'New here?',
		backToInvite: 'Back to your invite',
		createAccount: 'Create an account',
		gotCode: 'Got an invite code from a coach?',
		join: 'Join'
	},
	register: {
		pageTitle: 'Create an account',
		eyebrow: 'New to the box',
		title: 'Create account',
		intro:
			'Joining an existing box? Ask a coach for an invite link instead: it puts you straight on their board.',
		creating: 'Creating',
		submit: 'Create account'
	},
	join: {
		pageTitle: (box: string) => `Join ${box}`,
		pageTitleFallback: 'Invite',
		notFoundEyebrow: 'Invite not found',
		notFoundTitle: 'Wrong code',
		notFoundBody:
			'This invite does not exist or was cancelled. Check the link, or ask your coach for a new one.',
		expiredEyebrow: 'Invite expired',
		expiredTitle: 'Too late',
		expiredBody:
			'Invites last seven days and this one has run out. Ask your coach to send a fresh link.',
		goToLogin: 'Go to log in',
		invitedTo: 'You are invited to',
		inviteCode: (code: string) => `Invite ${code}`,
		alreadyMember: 'You are already part of this box.',
		seeToday: "See today's WoD",
		asCoach: 'As a coach you can program and edit the WoDs.',
		asAthlete:
			"You will see the WoD every day, run the timers and keep your PRs on the box's board.",
		joining: 'Joining',
		joinBox: (box: string) => `Join ${box}`,
		joinFailed: 'Could not join this box.',
		unreachable: 'Could not reach the server. Check your connection and try again.',
		createToJoin: 'Create your account to get on the board.',
		creating: 'Creating',
		createAndJoin: 'Create account & join'
	},
	error: {
		notFound: 'Not found',
		broke: 'Something broke',
		nothingHere: 'Nothing at this address',
		moved: 'The page may have moved, or the link was typed wrong.',
		needsConnection: 'This part needs a connection',
		offlineBody: "You are offline. Today's WoD, the list and the timers still work.",
		unexpected: 'An unexpected error.',
		nothingLost: 'Nothing you saved was lost.',
		backToToday: 'Back to today',
		tryAgain: 'Try again'
	},
	noBox: {
		pageTitle: 'Find your box',
		title: 'No box yet',
		body: (email: string) =>
			`You are signed in as ${email}, but you are not on any box\'s board. Ask a coach for an invite link, or type the code they gave you.`,
		inviteCode: 'Invite code',
		join: 'Join'
	},
	redirecting: 'Redirecting…'
};
