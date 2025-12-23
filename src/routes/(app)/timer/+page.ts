// src/routes/(app)/timer/+page.ts
import type { PageLoad } from './$types';
import type { TimerType } from '$lib/types/timer';

export const load: PageLoad = async ({ url }) => {
	const urlType = url.searchParams.get('type') as TimerType | null;
	const timerType: TimerType =
		urlType && ['amrap', 'emom', 'fortime', 'tabata'].includes(urlType) ? urlType : 'amrap';

	return {
		timerType
	};
};
