import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { timerConfigSchema as appTimerConfigSchema, type TimerConfig } from '$lib/types/timer';

/** True when the server has an OpenRouter key, i.e. the Magic Wand can actually run. */
export function isAiConfigured(): boolean {
	return Boolean(env.OPENROUTER_API_KEY?.trim());
}

/** Thrown when an AI feature is used on a server without OPENROUTER_API_KEY. */
export class AiNotConfiguredError extends Error {
	constructor() {
		super('OPENROUTER_API_KEY is not set');
		this.name = 'AiNotConfiguredError';
	}
}

/** Magic Wand model on OpenRouter. Override with MAGIC_WAND_MODEL (any OpenRouter model id). */
export const DEFAULT_WAND_MODEL = 'anthropic/claude-sonnet-5.5';

function wandModel(): string {
	return env.MAGIC_WAND_MODEL?.trim() || DEFAULT_WAND_MODEL;
}

// OpenRouter through the OpenAI-compatible provider. Created on first use so a server
// without a key still boots and every other feature keeps working.
function openrouter() {
	if (!isAiConfigured()) throw new AiNotConfiguredError();
	return createOpenAI({
		baseURL: 'https://openrouter.ai/api/v1',
		apiKey: env.OPENROUTER_API_KEY
	});
}

// What the model may send back for a timer. It is deliberately loose: the prompt examples
// use several spellings (interval, cap, workTime...), and normalizeTimerConfig() below turns
// whatever arrives into the app's own TimerConfig, or drops it.
const aiTimerSchema = z
	.object({
		type: z.enum(['amrap', 'fortime', 'emom', 'tabata']),
		duration: z.number().nullable(), // seconds: AMRAP length, EMOM total, For Time cap
		cap: z.number().nullable(), // seconds: For Time cap
		rounds: z.number().nullable(),
		interval: z.number().nullable(), // seconds: EMOM interval
		workTime: z.number().nullable(), // seconds: Tabata work
		restTime: z.number().nullable() // seconds: Tabata rest
	})
	.nullable();

export type AiTimer = z.infer<typeof aiTimerSchema>;

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, Math.round(value)));
const positive = (value: number | null | undefined): number | undefined =>
	typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;

/**
 * Convert the model's timer into a TimerConfig the timers can run. Missing values get the
 * usual box defaults and everything is clamped to what the timer screen accepts.
 */
export function normalizeTimerConfig(raw: AiTimer | undefined): TimerConfig | null {
	if (!raw) return null;

	let config: TimerConfig;
	switch (raw.type) {
		case 'amrap':
			config = { type: 'amrap', duration: clamp(positive(raw.duration) ?? 20 * 60, 60, 3600) };
			break;
		case 'fortime':
			config = {
				type: 'fortime',
				duration: clamp(positive(raw.cap) ?? positive(raw.duration) ?? 15 * 60, 60, 3600)
			};
			break;
		case 'emom': {
			const intervalWork = clamp(positive(raw.interval) ?? 60, 10, 300);
			const total = positive(raw.duration);
			const rounds = positive(raw.rounds) ?? (total ? total / intervalWork : 10);
			config = { type: 'emom', rounds: clamp(rounds, 1, 50), intervalWork };
			break;
		}
		case 'tabata':
			config = {
				type: 'tabata',
				rounds: clamp(positive(raw.rounds) ?? 8, 1, 20),
				intervalWork: clamp(positive(raw.workTime) ?? 20, 5, 60),
				intervalRest: clamp(positive(raw.restTime) ?? 10, 5, 60)
			};
			break;
		default:
			return null;
	}

	return appTimerConfigSchema.safeParse(config).success ? config : null;
}

// Section schema for AI response
const generatedSectionSchema = z.object({
	type: z.enum(['warmup', 'skill', 'wod', 'cooldown', 'stretches', 'custom']),
	name: z.string(),
	content: z.string(),
	timerConfig: aiTimerSchema
});

// Full response schema
const generateSectionsResponseSchema = z.object({
	sections: z.array(generatedSectionSchema)
});

export type GeneratedSection = z.infer<typeof generatedSectionSchema>;

const SYSTEM_PROMPT = `You are the head coach of a small CrossFit box. A coach describes a class in a few words; you turn it into the sections of the day's WoD, the way you would write it on the whiteboard.

# HOW MUCH TO WRITE
- Write what was asked. If the description is only a workout ("12 min AMRAP of..."), return only that wod section.
- If the description is a vague idea ("for time with pull-ups and light cleans"), build a full class: a short warmup that prepares the movements, an optional skill or strength piece that fits the theme, and the wod.
- Only add cooldown or stretches when asked.
- A class fits in about 60 minutes. Keep volume realistic for mixed-level athletes.

# SECTIONS
type is one of: warmup, skill (technique or strength), wod (the main workout), cooldown, stretches, custom (accessory or anything else).
name is short, like a whiteboard heading: "Warmup", "Back Squat", "Fran", "Partner Chipper".
content is plain text, one movement per line, standard CrossFit notation:
- First line states the format: "20 min AMRAP:", "3 Rounds For Time (15 min cap):", "E2MOM x 5:", "21-15-9 For Time:".
- Reps before the movement ("15 Wall Balls"), sets x reps for strength ("Back Squat 5x5 @ 75%").
- Common abbreviations are fine (T2B, C2B, HSPU, DU, BMU).
- Only write loads the coach gave, or the standard load of a named benchmark. Otherwise use a word: light, moderate, heavy.
- Write in the language of the description. Movement names stay in standard CrossFit English, as boxes in Brazil use them.

# TIMER
Every section with a clock gets a timerConfig; everything else gets null. All times are in seconds, and the timer must match what the content says.
- AMRAP: { type: "amrap", duration }. "12 min AMRAP" → { type: "amrap", duration: 720 }
- For Time: { type: "fortime", cap }. Use the cap written in the content; if none is given, choose a sensible one and write it in the content too. "21-15-9, 10 min cap" → { type: "fortime", cap: 600 }
- EMOM: { type: "emom", interval, rounds }. "10 min EMOM" → { type: "emom", interval: 60, rounds: 10 }. "E3MOM x 4" → { type: "emom", interval: 180, rounds: 4 }
- Tabata: { type: "tabata", workTime, restTime, rounds }. Default 20 / 10 / 8.
- Untimed warmups, untimed strength, and work/rest intervals the four timers can't express → null.

# BENCHMARKS
Use the standard version when a benchmark is named or clearly described: Fran (21-15-9 Thrusters 95/65 lb, Pull-ups), Cindy (20 min AMRAP 5 Pull-ups, 10 Push-ups, 15 Air Squats), Helen (3 RFT 400m Run, 21 KB Swings 53/35 lb, 12 Pull-ups), Murph (1 mile Run, 100 Pull-ups, 200 Push-ups, 300 Air Squats, 1 mile Run), Grace (30 Clean & Jerks 135/95 lb for time), DT, Isabel, Karen, Annie, Diane, Jackie and the like.

# EXAMPLES
Input: "12 minute AMRAP of 5 pull-ups, 10 push-ups, 15 air squats"
- { type: "wod", name: "AMRAP 12", content: "12 min AMRAP:\\n5 Pull-ups\\n10 Push-ups\\n15 Air Squats", timerConfig: { type: "amrap", duration: 720 } }

Input: "Back squat 5x5, depois 3 rounds for time de 15 deadlifts e 400m de corrida"
- { type: "skill", name: "Back Squat", content: "Back Squat 5x5\\nSubindo a carga a cada série", timerConfig: null }
- { type: "wod", name: "Metcon", content: "3 Rounds For Time (15 min cap):\\n15 Deadlifts (moderado)\\n400m Run", timerConfig: { type: "fortime", cap: 900 } }

Input: "For time workout with pull-ups and light hang cleans"
- { type: "warmup", name: "Warmup", content: "3 Rounds:\\n200m Row\\n10 Ring Rows\\n10 Empty Bar Hang Cleans\\n10 Air Squats", timerConfig: null }
- { type: "skill", name: "Hang Clean", content: "E2MOM x 5:\\n3 Hang Cleans (moderate)\\nPause at the knee on the first rep", timerConfig: { type: "emom", interval: 120, rounds: 5 } }
- { type: "wod", name: "Couplet", content: "21-15-9 For Time (10 min cap):\\nPull-ups\\nHang Cleans (light)", timerConfig: { type: "fortime", cap: 600 } }

Input: "Tabata de air squat e um chipper longo em dupla"
- { type: "warmup", name: "Aquecimento", content: "Tabata:\\nAir Squats", timerConfig: { type: "tabata", workTime: 20, restTime: 10, rounds: 8 } }
- { type: "wod", name: "Chipper em Dupla", content: "For Time em dupla (30 min cap):\\n100 Wall Balls\\n80 Box Jumps\\n60 Toes-to-Bar\\n40 Power Cleans (moderado)\\n20 Bar Muscle-ups\\nDivide as reps como quiser, um trabalha por vez", timerConfig: { type: "fortime", cap: 1800 } }`;

export type GeneratedWodSection = Omit<GeneratedSection, 'timerConfig'> & {
	timerConfig: TimerConfig | null;
};

export async function generateWodSections(description: string): Promise<GeneratedWodSection[]> {
	const { output } = await generateText({
		model: openrouter().chat(wandModel()),
		output: Output.object({
			schema: generateSectionsResponseSchema
		}),
		system: SYSTEM_PROMPT,
		prompt: `Generate workout sections for this description:\n\n${description}`
	});

	return (output?.sections ?? []).map((section) => ({
		...section,
		name: section.name.trim().slice(0, 100) || 'Section',
		content: section.content.trim().slice(0, 2000),
		timerConfig: normalizeTimerConfig(section.timerConfig)
	}));
}
