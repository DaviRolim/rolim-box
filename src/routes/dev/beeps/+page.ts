// src/routes/dev/beeps/+page.ts
import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	// Keep this page dev-only (it exists purely to iterate on beep settings quickly).
	if (!dev) throw error(404, 'Not found');
	return {};
};


