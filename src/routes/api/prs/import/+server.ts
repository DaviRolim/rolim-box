import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { exercise, personalRecord } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { env } from '$env/dynamic/private';
import { importAnalysisResponseSchema } from '$lib/types/pr';

const openrouter = createOpenAI({
	baseURL: 'https://openrouter.ai/api/v1',
	apiKey: env.OPENROUTER_API_KEY
});

const SYSTEM_PROMPT = `You are a fitness data extraction assistant. Extract personal records (PRs) from the provided image and match them to the given exercise database.

TASK:
1. Identify exercise names and their PR values from the image
2. Match each exercise to the closest one in the database (fuzzy match)
3. Detect units (kg, lbs, seconds, minutes, reps, meters, miles) and convert to base units
4. Return structured JSON

UNIT CONVERSIONS (to base units):
- Weight: kg × 1000 = grams, lbs × 453.592 = grams
- Time: parse MM:SS or HH:MM:SS to total seconds
- Distance: meters × 100 = centimeters, miles × 160934 = centimeters
- Reps: count as-is

MATCHING RULES:
- Only match if >70% confident in the match
- Consider common variations: "Back Squat" = "Back Squat (1RM)", "C&J" = "Clean and Jerk"
- If no good match, add to unmatched list

CONFIDENCE LEVELS:
- high: exact or near-exact name match
- medium: similar name, likely correct
- low: fuzzy match, user should verify`;

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Parse multipart form data
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return json({ error: 'Invalid form data' }, { status: 400 });
	}

	const imageFile = formData.get('image') as File | null;
	if (!imageFile) {
		return json({ error: 'No image provided' }, { status: 400 });
	}

	// Validate file type
	const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
	if (!validTypes.includes(imageFile.type)) {
		return json({ error: 'Invalid file type. Please upload PNG, JPG, or WEBP.' }, { status: 400 });
	}

	// Validate file size (5MB max)
	const maxSize = 5 * 1024 * 1024;
	if (imageFile.size > maxSize) {
		return json({ error: 'Image must be smaller than 5MB' }, { status: 400 });
	}

	// Get all exercises for matching
	const exercises = await db
		.select({
			id: exercise.id,
			name: exercise.name,
			measurementType: exercise.measurementType
		})
		.from(exercise)
		.orderBy(asc(exercise.sortOrder));

	// Get user's existing PRs for conflict detection
	const existingPRs = await db
		.select({
			exerciseId: personalRecord.exerciseId,
			value: personalRecord.value
		})
		.from(personalRecord)
		.where(eq(personalRecord.userId, locals.user.id));

	const existingPRMap = new Map(existingPRs.map((pr) => [pr.exerciseId, pr.value]));

	// Convert image to base64
	const imageBuffer = await imageFile.arrayBuffer();
	const base64Image = Buffer.from(imageBuffer).toString('base64');

	// Build prompt with exercise database
	const exerciseList = exercises
		.map((e) => `- ID: ${e.id}, Name: "${e.name}", Type: ${e.measurementType}`)
		.join('\n');

	const userPrompt = `Extract all personal records from this image and match them to these exercises:

${exerciseList}

Return JSON with this exact structure:
{
  "matched": [
    {
      "exerciseId": "the-exercise-id",
      "exerciseName": "Exercise Name",
      "originalText": "exact text from image",
      "value": 12345,
      "confidence": "high"
    }
  ],
  "unmatched": ["Exercise Name 1", "Exercise Name 2"]
}`;

	try {
		const { output } = await generateText({
			model: openrouter('google/gemini-2.0-flash-001'),
			output: Output.object({
				schema: importAnalysisResponseSchema
			}),
			system: SYSTEM_PROMPT,
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'image',
							image: base64Image
						},
						{
							type: 'text',
							text: userPrompt
						}
					]
				}
			]
		});

		if (!output) {
			return json({ error: 'Failed to analyze image' }, { status: 500 });
		}

		// Enrich with conflict information
		const enrichedMatched = output.matched.map((pr) => ({
			...pr,
			hasConflict: existingPRMap.has(pr.exerciseId),
			existingValue: existingPRMap.get(pr.exerciseId) ?? null
		}));

		return json({
			matched: enrichedMatched,
			unmatched: output.unmatched
		});
	} catch (error) {
		console.error('Import analysis error:', error);
		return json({ error: 'Failed to analyze image. Please try again.' }, { status: 500 });
	}
};
