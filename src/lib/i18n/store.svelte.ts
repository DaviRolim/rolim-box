import { browser } from '$app/environment';
import {
	DEFAULT_LOCALE,
	HTML_LANG,
	LOCALE_COOKIE,
	LOCALE_STORAGE_KEY,
	isLocale,
	setLocaleSource,
	type Locale
} from './locale';

const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(): Locale | null {
	const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`));
	return match && isLocale(match[1]) ? match[1] : null;
}

function readStorage(): Locale | null {
	try {
		const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
		return isLocale(saved) ? saved : null;
	} catch {
		return null;
	}
}

/**
 * The language on screen. The server renders with the cookie's language (root layout data),
 * the browser starts from that same value so hydration matches, then `restore()` catches the
 * one case where they can differ: a page served from the offline cache after a switch.
 */
class LocaleStore {
	current = $state<Locale>(DEFAULT_LOCALE);

	constructor() {
		setLocaleSource(() => this.current);
	}

	/** Called by the root layout with the language the server rendered in. */
	init(locale: Locale): void {
		this.current = locale;
	}

	/** In the browser, after mount: the saved choice wins over a stale cached page. */
	restore(): void {
		if (!browser) return;
		const saved = readCookie() ?? readStorage();
		if (saved && saved !== this.current) this.current = saved;
		this.#persist();
		this.#paint();
	}

	set(locale: Locale): void {
		this.current = locale;
		if (!browser) return;
		this.#persist();
		this.#paint();
	}

	#persist(): void {
		document.cookie = `${LOCALE_COOKIE}=${this.current}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
		try {
			localStorage.setItem(LOCALE_STORAGE_KEY, this.current);
		} catch {
			// private mode: the cookie still carries it
		}
	}

	#paint(): void {
		document.documentElement.lang = HTML_LANG[this.current];
	}
}

export const localeStore = new LocaleStore();
