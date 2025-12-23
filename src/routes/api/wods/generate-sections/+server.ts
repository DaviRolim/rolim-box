import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { generateWodSections } from '$lib/server/ai';

const requestSchema = z.object({
	description: z.string().min(5, 'Description must be at least 5 characters')
});

export const POST: RequestHandler = async ({ locals, request }) => {
	// Check authentication
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Parse and validate request body
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const validation = requestSchema.safeParse(body);
	if (!validation.success) {
		return json(
			{
				error: 'Validation failed',
				details: validation.error.flatten()
			},
			{ status: 400 }
		);
	}

	try {
		const sections = await generateWodSections(validation.data.description);

		if (sections.length === 0) {
			return json(
				{ error: 'Could not generate sections from this description. Try adding more detail.' },
				{ status: 422 }
			);
		}

		// Convert timerConfig objects to JSON strings to match Section type
		const formattedSections = sections.map((section, index) => ({
			type: section.type,
			name: section.name,
			content: section.content,
			order: index,
			timerConfig: section.timerConfig ? JSON.stringify(section.timerConfig) : null
		}));

		return json({ sections: formattedSections });
	} catch (error) {
		console.error('AI generation error:', error);

		// Check for specific error types
		if (error instanceof Error) {
			if (error.message.includes('API key')) {
				return json({ error: 'AI service configuration error' }, { status: 500 });
			}
			if (error.message.includes('rate') || error.message.includes('limit')) {
				return json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
			}
		}

		return json({ error: 'Failed to generate sections. Please try again.' }, { status: 500 });
	}
};
