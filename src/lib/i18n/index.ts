/**
 * RolimBox's tiny i18n: one typed dictionary per locale and a `t` that always points at the
 * active one.
 *
 *   import { t } from '$lib/i18n';
 *   {t.nav.today}            → "Today" / "Hoje"
 *   {t.today.parts(4)}       → "4 parts" / "4 partes"
 *
 * The Portuguese dictionary is typed as the English one (`Dict`), so a missing, extra or
 * misspelled key is a type error. Painted brand phrases ("Vai doer", "Bora!", "Acabou!") are
 * not in here: they are Portuguese in both languages and stay in the markup.
 */
import { en, type Dict } from './en';
import { pt } from './pt';
import { currentLocale, type Locale } from './locale';

export type { Dict } from './en';
export * from './locale';

export const dictionaries: Record<Locale, Dict> = { en, pt };

/** The dictionary for a given locale (server code passes `locals.locale`). */
export function dictFor(locale: Locale): Dict {
	return dictionaries[locale];
}

/**
 * The active dictionary. Every property read goes through the current locale, so markup and
 * `$derived` values that read `t.something` update when the language changes.
 */
export const t: Dict = new Proxy({} as Dict, {
	get: (_, key) => dictionaries[currentLocale()][key as keyof Dict],
	has: (_, key) => key in dictionaries[currentLocale()],
	ownKeys: () => Reflect.ownKeys(dictionaries[currentLocale()]),
	getOwnPropertyDescriptor: (_, key) =>
		Reflect.getOwnPropertyDescriptor(dictionaries[currentLocale()], key)
});
