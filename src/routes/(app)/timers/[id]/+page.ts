// src/routes/(app)/timers/[id]/+page.ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	return {
		timerId: params.id
	};
};
