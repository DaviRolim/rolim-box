/**
 * The active language, without any Svelte in it, so plain modules (date helpers, the sync
 * queue, unit tests) can ask for it too.
 *
 * The reactive value lives in `./store.svelte.ts`, which plugs itself in with
 * `setLocaleSource`. Reading the locale through the source inside a component or `$derived`
 * makes that code re-run when the person flips EN | PT.
 */

export const LOCALES = ['en', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Cookie read by the server (so the first paint is already in the right language). */
export const LOCALE_COOKIE = 'rolimbox-lang';
/** Fallback for when cookies are cleared or blocked. */
export const LOCALE_STORAGE_KEY = 'rolimbox:lang';

/** BCP 47 tags for `Intl` and `<html lang>`. English stays day-first, the way Brazil reads dates. */
export const INTL_LOCALE: Record<Locale, string> = { en: 'en-GB', pt: 'pt-BR' };
export const HTML_LANG: Record<Locale, string> = { en: 'en', pt: 'pt-BR' };

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Anything unknown (or missing) is English: the app never guesses from the browser. */
export function parseLocale(value: unknown): Locale {
	return isLocale(value) ? value : DEFAULT_LOCALE;
}

let source: () => Locale = () => DEFAULT_LOCALE;

export function setLocaleSource(read: () => Locale): void {
	source = read;
}

export function currentLocale(): Locale {
	return source();
}

export function intlLocale(locale: Locale = currentLocale()): string {
	return INTL_LOCALE[locale];
}
