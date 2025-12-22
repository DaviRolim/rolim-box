import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { workspaceMember } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) throw redirect(302, '/login');

	// Get user's workspace membership
	const membership = await db
		.select()
		.from(workspaceMember)
		.where(eq(workspaceMember.userId, user.id))
		.limit(1);

	return {
		workspaceId: membership[0]?.workspaceId || null
	};
};
