import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { workspace } = await parent();

	return {
		workspaceId: workspace?.id || null
	};
};
