import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { env } from '$env/dynamic/private';

// Configure OpenRouter as OpenAI-compatible provider
const openrouter = createOpenAI({
	baseURL: 'https://openrouter.ai/api/v1',
	apiKey: env.OPENROUTER_API_KEY
});

// Timer config schema for AI response
const timerConfigSchema = z
	.object({
		type: z.enum(['amrap', 'fortime', 'emom', 'tabata']),
		duration: z.number().optional(), // seconds
		rounds: z.number().optional(),
		workTime: z.number().optional(), // for tabata
		restTime: z.number().optional() // for tabata
	})
	.nullable();

// Section schema for AI response
const generatedSectionSchema = z.object({
	type: z.enum(['warmup', 'skill', 'wod', 'cooldown', 'stretches', 'custom']),
	name: z.string(),
	content: z.string(),
	timerConfig: timerConfigSchema
});

// Full response schema
const generateSectionsResponseSchema = z.object({
	sections: z.array(generatedSectionSchema)
});

export type GeneratedSection = z.infer<typeof generatedSectionSchema>;

const SYSTEM_PROMPT = `You are a CrossFit/functional fitness workout designer. Given a workout description, generate structured workout sections.

RULES:
1. Always include appropriate sections based on the description
2. Common structure: warmup -> skill/strength -> wod -> cooldown (but adapt to description)
3. For timer configs, infer from workout text:
   - "AMRAP X" or "X minute AMRAP" -> amrap with duration in seconds
   - "For Time" or "X rounds for time" -> fortime with rounds
   - "EMOM X" -> emom with duration in seconds
   - "Tabata" -> tabata with workTime=20, restTime=10 (or as specified)
4. If no timer pattern detected, set timerConfig to null
5. Keep section names concise (e.g., "Warmup", "Strength", "Metcon", "Cool-down")
6. Format content with line breaks between exercises
7. Use standard exercise notation (e.g., "3x10 Back Squats @70%", "21-15-9 Thrusters/Pull-ups")

SECTION TYPES:
- warmup: General warm-up, mobility, activation
- skill: Skill practice, technique work
- wod: The main workout/metcon
- cooldown: Cool-down, recovery
- stretches: Stretching, flexibility work
- custom: Anything that doesn't fit above`;

export async function generateWodSections(description: string): Promise<GeneratedSection[]> {
	const { object } = await generateObject({
		model: openrouter('google/gemini-2.0-flash-001'),
		schema: generateSectionsResponseSchema,
		system: SYSTEM_PROMPT,
		prompt: `Generate workout sections for this description:\n\n${description}`
	});

	return object.sections;
}
