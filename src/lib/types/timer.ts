// src/lib/types/timer.ts
import { z } from 'zod';

// ============================================================================
// Type Definitions
// ============================================================================

export type TimerType = 'amrap' | 'emom' | 'fortime' | 'tabata';

export type TimerState = 'idle' | 'countdown' | 'running' | 'paused' | 'completed';

export const TIMER_TYPES = ['amrap', 'emom', 'fortime', 'tabata'] as const;

export interface TimerConfig {
	type: TimerType;
	duration?: number; // seconds - AMRAP total, FOR TIME cap
	rounds?: number; // EMOM & TABATA round count
	intervalWork?: number; // seconds - EMOM interval, TABATA work
	intervalRest?: number; // seconds - TABATA rest only
}

export interface TimerContext {
	sectionId?: string;
	sectionName?: string;
	wodId?: string;
}

// ============================================================================
// Default Configurations
// ============================================================================

export const TIMER_DEFAULTS: Record<TimerType, TimerConfig> = {
	amrap: { type: 'amrap', duration: 20 * 60 }, // 20 minutes
	emom: { type: 'emom', rounds: 10, intervalWork: 60 }, // 10 rounds x 60s
	fortime: { type: 'fortime', duration: 15 * 60 }, // 15 minute cap
	tabata: { type: 'tabata', rounds: 8, intervalWork: 20, intervalRest: 10 } // 8 rounds x 20s/10s
};

export const TIMER_LABELS: Record<TimerType, string> = {
	amrap: 'AMRAP',
	emom: 'EMOM',
	fortime: 'FOR TIME',
	tabata: 'TABATA'
};

// ============================================================================
// Zod Validation Schemas
// ============================================================================

export const timerConfigSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('amrap'),
		duration: z.number().min(60).max(3600) // 1-60 minutes in seconds
	}),
	z.object({
		type: z.literal('emom'),
		rounds: z.number().min(1).max(50),
		intervalWork: z.number().min(10).max(300) // 10s-5min
	}),
	z.object({
		type: z.literal('fortime'),
		duration: z.number().min(60).max(3600) // 1-60 minutes cap in seconds
	}),
	z.object({
		type: z.literal('tabata'),
		rounds: z.number().min(1).max(20),
		intervalWork: z.number().min(5).max(60),
		intervalRest: z.number().min(5).max(60)
	})
]);

// ============================================================================
// Helper Functions
// ============================================================================

export function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimeMs(ms: number): string {
	return formatTime(Math.ceil(ms / 1000));
}

export function parseTimerConfig(json: string | null): TimerConfig | null {
	if (!json) return null;
	try {
		const parsed = JSON.parse(json);
		const result = timerConfigSchema.safeParse(parsed);
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}

export function serializeTimerConfig(config: TimerConfig): string {
	return JSON.stringify(config);
}

export function getTotalDuration(config: TimerConfig): number {
	switch (config.type) {
		case 'amrap':
		case 'fortime':
			return config.duration ?? 0;
		case 'emom':
			return (config.rounds ?? 0) * (config.intervalWork ?? 0);
		case 'tabata':
			return (config.rounds ?? 0) * ((config.intervalWork ?? 0) + (config.intervalRest ?? 0));
	}
}
