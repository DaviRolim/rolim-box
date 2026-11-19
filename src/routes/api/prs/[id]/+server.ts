import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dictFor } from '$lib/i18n';
import { db } from '$lib/server/db';
import { personalRecord } from '$lib/server/db/schema';
import { updatePRSchema } from '$lib/types/pr';
import { eq, and } from 'drizzle-orm';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		return json({ error: dictFor(locals.locale).api.unauthorized }, { status: 401 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: dictFor(locals.locale).api.invalidJson }, { status: 400 });
	}

	const validation = updatePRSchema.safeParse(body);
	if (!validation.success) {
		return json(
			{
				error: dictFor(locals.locale).api.validationFailed,
				details: validation.error.flatten()
			},
			{ status: 400 }
		);
	}

	const [pr] = await db
		.update(personalRecord)
		.set({ videoUrl: validation.data.videoUrl, updatedAt: new Date() })
		.where(and(eq(personalRecord.id, params.id), eq(personalRecord.userId, locals.user.id)))
		.returning();

	if (!pr) return json({ error: dictFor(locals.locale).prs.api.notFound }, { status: 404 });
	return json(pr);
};

/**
 * DELETE /api/prs/[id]
 * Deletes a PR (only if owned by current user)
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		return json({ error: dictFor(locals.locale).api.unauthorized }, { status: 401 });
	}

	const { id } = params;

	// Verify PR exists and belongs to user
	const [pr] = await db
		.select()
		.from(personalRecord)
		.where(and(eq(personalRecord.id, id), eq(personalRecord.userId, locals.user.id)));

	if (!pr) {
		return json({ error: dictFor(locals.locale).prs.api.notFound }, { status: 404 });
	}

	await db.delete(personalRecord).where(eq(personalRecord.id, id));

	return json({ success: true });
};
