import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { workspaceMember } from '$lib/server/db/schema';
import { AiNotConfiguredError, generateWodSections, isAiConfigured } from '$lib/server/ai';
import { canEditWods } from '$lib/server/wods';
import { serializeTimerConfig } from '$lib/types/timer';

const requestSchema = z.object({
	description: z
		.string()
		.trim()
		.min(5, 'Description must be at least 5 characters')
		.max(2000, 'Description too long')
});

const NOT_CONFIGURED = {
	error: 'The Magic Wand is not set up on this server yet. You can still add sections by hand.',
	code: 'ai_not_configured'
} as const;

/**
 * POST /api/wods/generate-sections  { description }
 * The "Magic Wand": drafts WoD sections from a free-text brief. Coaches and owners only.
 *
 * Error responses carry a `code` so the editor can react: ai_not_configured (503),
 * rate_limited (429), no_sections (422), ai_failed (502).
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const memberships = await db
		.select({ role: workspaceMember.role })
		.from(workspaceMember)
		.where(eq(workspaceMember.userId, locals.user.id));
	if (!memberships.some((m) => canEditWods(m.role))) {
		return json({ error: 'Only coaches can generate workouts' }, { status: 403 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const validation = requestSchema.safeParse(body);
	if (!validation.success) {
		return json(
			{ error: 'Validation failed', details: validation.error.flatten() },
			{ status: 400 }
		);
	}

	if (!isAiConfigured()) {
		return json(NOT_CONFIGURED, { status: 503 });
	}

	try {
		const sections = await generateWodSections(validation.data.description);

		if (sections.length === 0) {
			return json(
				{
					error: 'Could not draft sections from this description. Try adding more detail.',
					code: 'no_sections'
				},
				{ status: 422 }
			);
		}

		return json({
			sections: sections.map((section, index) => ({
				type: section.type,
				name: section.name,
				content: section.content,
				order: index,
				timerConfig: section.timerConfig ? serializeTimerConfig(section.timerConfig) : null
			}))
		});
	} catch (error) {
		if (error instanceof AiNotConfiguredError) {
			return json(NOT_CONFIGURED, { status: 503 });
		}

		console.error('AI generation error:', error);

		const message = error instanceof Error ? error.message.toLowerCase() : '';
		if (message.includes('api key') || message.includes('unauthorized') || message.includes('401')) {
			return json(
				{
					error: 'The Magic Wand key was rejected. Check OPENROUTER_API_KEY on the server.',
					code: 'ai_not_configured'
				},
				{ status: 503 }
			);
		}
		if (message.includes('rate') || message.includes('limit') || message.includes('429')) {
			return json(
				{ error: 'Too many requests. Wait a moment and try again.', code: 'rate_limited' },
				{ status: 429 }
			);
		}

		return json(
			{ error: 'The Magic Wand could not draft this one. Try again.', code: 'ai_failed' },
			{ status: 502 }
		);
	}
};
