import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import * as auth from '$lib/server/auth';
import { HTML_LANG, LOCALE_COOKIE, parseLocale } from '$lib/i18n/locale';

/**
 * The language comes from the person's own choice (the EN | PT toggle writes a cookie) and
 * nothing else: no Accept-Language guessing. It is set before anything renders, so the page
 * arrives in the right language with the right `<html lang>`.
 */
const handleLocale: Handle = ({ event, resolve }) => {
	const locale = parseLocale(event.cookies.get(LOCALE_COOKIE));
	event.locals.locale = locale;
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%rolimbox.lang%', HTML_LANG[locale])
	});
};

const handleAuth: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(auth.sessionCookieName);

	if (!sessionToken) {
		event.locals.user = null;
		event.locals.session = null;

		return resolve(event);
	}

	const { session, user } = await auth.validateSessionToken(sessionToken);

	if (session) {
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
	} else {
		auth.deleteSessionTokenCookie(event);
	}

	event.locals.user = user;
	event.locals.session = session;

	return resolve(event);
};

export const handle: Handle = sequence(handleLocale, handleAuth);
