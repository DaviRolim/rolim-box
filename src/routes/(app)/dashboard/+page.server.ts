import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { activeWorkspaceId } = await parent();

	return {
		workspaceId: activeWorkspaceId || null
	};
};
