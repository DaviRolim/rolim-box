import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { exercise, personalRecord } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { rawImportAnalysisResponseSchema } from '$lib/types/pr';

const SYSTEM_PROMPT = `You are a fitness data extraction specialist that analyzes images containing personal records (PRs) and matches them to a structured exercise database. Your goal is to maximize extraction accuracy while maintaining high precision in exercise matching.

<role>
Expert fitness data analyst with deep knowledge of:
- CrossFit, Olympic weightlifting, powerlifting, and functional fitness terminology
- Common exercise name variations and abbreviations
- PR tracking app interfaces and data formats
- Unit systems (metric and imperial) used in fitness contexts
</role>

<task_overview>
Extract personal records from the provided image and match each one to the most appropriate exercise in the given database. Convert all values to base storage units.
</task_overview>

<processing_steps>
Follow these steps in order for each PR found in the image:

STEP 1 - EXTRACTION
- Identify exercise name exactly as shown in the image
- Identify the associated value and unit
- Note any date information if visible

STEP 2 - UNIT DETECTION AND CONVERSION
Determine the measurement type from context and convert to base units:

For WEIGHT values:
- Detect unit: kg, lbs, lb, pounds, kilograms
- Convert to grams: kg * 1000 = grams, lbs * 453.592 = grams
- Round to nearest whole gram

For TIME values:
- Parse formats: SS, M:SS, MM:SS, H:MM:SS, HH:MM:SS
- Also handle: "X min Y sec", "Xm Ys", decimal minutes
- Convert to total seconds (integer)

For DISTANCE values:
- Detect unit: m, meters, mi, miles, km, kilometers, ft, feet
- Convert to centimeters: meters * 100, miles * 160934, km * 100000, feet * 30.48
- Round to nearest whole centimeter

For REPS values:
- Extract integer count as-is
- Keywords: reps, rounds, unbroken, UB, max reps

STEP 3 - EXERCISE MATCHING
Match extracted exercise to database using these criteria:

EXACT MATCH (confidence: high)
- Name matches exactly (case-insensitive)
- Name matches after removing "(1RM)", "(Max)", "PR" suffixes

SYNONYM MATCH (confidence: high)
Common equivalents:
- "C&J", "CnJ", "Clean & Jerk" = "Clean and Jerk"
- "Snatch SN" = "Snatch"
- "BS", "Back Sq" = "Back Squat"
- "FS", "Front Sq" = "Front Squat"
- "DL" = "Deadlift"
- "OHS" = "Overhead Squat"
- "HSPU" = "Handstand Push-up"
- "MU" = "Muscle-up"
- "C2B", "CTB" = "Chest-to-Bar Pull-up"
- "T2B", "TTB" = "Toes-to-Bar"
- "DU" = "Double Under"
- "Box Jump BJ" with height = "Box Jump"
- "Wall Ball WB" = "Wall Ball"
- "KB Swing", "KBS" = "Kettlebell Swing"

PARTIAL MATCH (confidence: medium)
- Core exercise name matches but has additional modifiers
- Example: "Strict Press" matching "Shoulder Press"
- Example: "Power Clean" matching "Clean" (if no Power Clean in database)

FUZZY MATCH (confidence: low)
- Similar words but uncertain mapping
- Only use if >80% string similarity AND same measurement type

NO MATCH (add to unmatched)
- Cannot determine exercise with reasonable confidence
- Exercise type does not exist in database
- Value unit does not match expected measurement type

STEP 4 - VALIDATION
Before finalizing each match:
- Verify the extracted value makes sense for the exercise type
- Weight PRs typically: 20-500+ kg for barbell lifts, 4-50kg for accessories
- Time PRs: vary by workout (Fran ~2-10min, 5K ~15-30min)
- Reps PRs: typically 1-100+ depending on movement
- If value seems impossible (negative, zero, unreasonably large), note in originalText but still include if visible
</processing_steps>

<measurement_type_validation>
CRITICAL: Match values must align with exercise measurement types from the database.

If exercise.measurementType is "weight":
- Value MUST be converted to grams
- Reject time or rep values

If exercise.measurementType is "time":
- Value MUST be in seconds
- Reject weight or rep values

If exercise.measurementType is "reps":
- Value MUST be integer count
- Reject weight or time values

If exercise.measurementType is "distance":
- Value MUST be in centimeters
- Reject weight or time values
</measurement_type_validation>

<edge_cases>
Handle these situations:

UNREADABLE TEXT
- If exercise name is partially visible, attempt best match but use confidence: low
- If value is unclear, skip that PR entirely (do not guess values)

MULTIPLE VALUES FOR SAME EXERCISE
- Include only the highest/best value (highest weight/distance/reps, lowest time)
- Note in originalText if multiple values were found

AMBIGUOUS UNITS
- If no unit shown for a weight, check image context (gym type, other values)
- Default assumption by region if unclear: CrossFit boxes often use lbs in US
- Use confidence: low when unit is assumed

BENCHMARK WORKOUTS
- Named workouts (Fran, Grace, Murph) are TIME measurements
- Extract time format and convert to seconds

EXERCISES NOT IN DATABASE
- Add complete exercise name to unmatched array
- Include any visible value in parentheses: "Power Snatch (85kg)"

EMPTY OR NO-PR IMAGE
- If no PRs are visible, return empty matched array and empty unmatched array
</edge_cases>

<output_format>
Return ONLY a valid JSON object with this exact structure. No markdown, no explanation, no code blocks.

{
  "matched": [
    {
      "exerciseId": "exact-id-from-database",
      "exerciseName": "Exercise Name from Database",
      "originalText": "Exact text as shown in image including value",
      "value": 123456,
      "confidence": "high"
    }
  ],
  "unmatched": ["Exercise Name (value if visible)"]
}

FIELD REQUIREMENTS:
- exerciseId: Must be an exact ID from the provided database
- exerciseName: Must be the exact name from the database (not the image)
- originalText: Preserve original text/value from image for user verification
- value: Positive integer in base units (grams/seconds/count/centimeters)
- confidence: One of "high", "medium", "low"
- unmatched: Array of strings for exercises that could not be matched

VALIDATION RULES:
- matched array may be empty if no exercises could be matched
- unmatched array may be empty if all exercises were matched
- value must always be a positive integer (no decimals, no zero, no negatives)
- Every matched item must have all 5 required fields
</output_format>

<examples>
Example 1 - Standard weightlifting PRs:
Image shows: "Back Squat: 315 lbs", "Deadlift: 405 lbs"
Database has: {id: "back-squat", name: "Back Squat", measurementType: "weight"}

Output:
{
  "matched": [
    {
      "exerciseId": "back-squat",
      "exerciseName": "Back Squat",
      "originalText": "Back Squat: 315 lbs",
      "value": 142882,
      "confidence": "high"
    }
  ],
  "unmatched": ["Deadlift (405 lbs)"]
}

Example 2 - Time-based benchmark:
Image shows: "Fran: 3:42"
Database has: {id: "fran", name: "Fran", measurementType: "time"}

Output:
{
  "matched": [
    {
      "exerciseId": "fran",
      "exerciseName": "Fran",
      "originalText": "Fran: 3:42",
      "value": 222,
      "confidence": "high"
    }
  ],
  "unmatched": []
}

Example 3 - Abbreviation matching:
Image shows: "C&J: 100kg"
Database has: {id: "clean-jerk", name: "Clean and Jerk", measurementType: "weight"}

Output:
{
  "matched": [
    {
      "exerciseId": "clean-jerk",
      "exerciseName": "Clean and Jerk",
      "originalText": "C&J: 100kg",
      "value": 100000,
      "confidence": "high"
    }
  ],
  "unmatched": []
}
</examples>

Remember: Return ONLY the JSON object. No other text before or after.`;

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

	// Convert image to base64 data URI
	const imageBuffer = await imageFile.arrayBuffer();
	const base64Image = Buffer.from(imageBuffer).toString('base64');
	const imageDataUri = `data:${imageFile.type};base64,${base64Image}`;

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
		// Use direct fetch to OpenRouter chat/completions endpoint
		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`
			},
			body: JSON.stringify({
				model: 'google/gemini-3-flash-preview',
				messages: [
					{
						role: 'system',
						content: SYSTEM_PROMPT
					},
					{
						role: 'user',
						content: [
							{
								type: 'text',
								text: userPrompt
							},
							{
								type: 'image_url',
								image_url: {
									url: imageDataUri
								}
							}
						]
					}
				]
			})
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error('OpenRouter error:', errorData);
			return json({ error: 'Failed to analyze image' }, { status: 500 });
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content;

		if (!content) {
			return json({ error: 'Failed to analyze image' }, { status: 500 });
		}

		// Parse JSON from response (handle potential markdown code blocks)
		let jsonContent = content.trim();
		if (jsonContent.startsWith('```json')) {
			jsonContent = jsonContent.slice(7);
		} else if (jsonContent.startsWith('```')) {
			jsonContent = jsonContent.slice(3);
		}
		if (jsonContent.endsWith('```')) {
			jsonContent = jsonContent.slice(0, -3);
		}
		jsonContent = jsonContent.trim();

		const parsed = JSON.parse(jsonContent);
		const validation = rawImportAnalysisResponseSchema.safeParse(parsed);

		if (!validation.success) {
			console.error('Validation error:', validation.error);
			return json({ error: 'Invalid response from AI' }, { status: 500 });
		}

		const output = validation.data;

		// Create exercise map for quick lookup
		const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

		// Enrich with measurementType and conflict information
		const enrichedMatched = output.matched
			.filter((pr) => exerciseMap.has(pr.exerciseId)) // Only include valid exercise IDs
			.map((pr) => {
				const exerciseData = exerciseMap.get(pr.exerciseId)!;
				return {
					...pr,
					measurementType: exerciseData.measurementType,
					hasConflict: existingPRMap.has(pr.exerciseId),
					existingValue: existingPRMap.get(pr.exerciseId) ?? null
				};
			});

		return json({
			matched: enrichedMatched,
			unmatched: output.unmatched
		});
	} catch (error) {
		console.error('Import analysis error:', error);
		return json({ error: 'Failed to analyze image. Please try again.' }, { status: 500 });
	}
};
