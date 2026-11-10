/**
 * Error messages the API sends back. They are written in the language of the request (the
 * locale cookie travels with every fetch), because the app shows them as they come.
 * Server code reads them with `dictFor(locals.locale).api`.
 */
export const api = {
	unauthorized: 'You are signed out. Log in again.',
	invalidJson: 'The request could not be read.',
	validationFailed: 'Some of the details are not valid.',
	notMember: 'You are not a member of this box.',
	workspaceRequired: 'Pick a box first.',
	ownersOnly: 'Only the owner of the box can do that.',
	soleOwner: 'You are the only owner, so you cannot remove yourself. Hand the box over first.',
	invalidRole: 'An invite is for a coach or an athlete.',
	inviteNotFound: 'This invite does not exist anymore.',
	inviteCodeRequired: 'Type the invite code.',
	inviteInvalid: 'This invite code does not exist.',
	inviteExpired: 'This invite has expired. Ask for a new one.',
	alreadyMember: 'You are already a member of this box.'
};
