import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { personalRecord } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * DELETE /api/prs/[id]
 * Deletes a PR (only if owned by current user)
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id } = params;

	// Verify PR exists and belongs to user
	const [pr] = await db
		.select()
		.from(personalRecord)
		.where(
			and(
				eq(personalRecord.id, id),
				eq(personalRecord.userId, locals.user.id)
			)
		);

	if (!pr) {
		return json({ error: 'PR not found' }, { status: 404 });
	}

	await db.delete(personalRecord).where(eq(personalRecord.id, id));

	return json({ success: true });
};
