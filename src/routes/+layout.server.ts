import type { LayoutServerLoad } from './$types';

/** The language the server is rendering in, so the browser hydrates in the same one. */
export const load: LayoutServerLoad = ({ locals }) => ({ locale: locals.locale });
