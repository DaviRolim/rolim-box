import { describe, expect, test } from 'bun:test';
import {
	bulkImportItemSchema,
	createPRSchema,
	prVideoUrlSchema,
	updatePRSchema
} from '../src/lib/types/pr';

describe('PR video links', () => {
	test.each([
		'https://www.youtube.com/shorts/example',
		'https://youtu.be/example?t=10',
		'https://youtube.com/watch?v=example',
		'http://example.com/video'
	])('accepts and trims %s', (url) => {
		expect(prVideoUrlSchema.parse(` ${url} `)).toBe(url);
	});

	test.each([
		'not a URL',
		'/watch?v=example',
		'https://',
		'https:example.com',
		'javascript:alert(1)',
		'ftp://example.com/video'
	])('rejects %s', (url) => {
		expect(prVideoUrlSchema.safeParse(url).success).toBe(false);
	});

	test('limits the length to 500 characters', () => {
		const url = 'https://example.com/'.padEnd(500, 'a');
		expect(prVideoUrlSchema.parse(url)).toBe(url);
		expect(prVideoUrlSchema.safeParse(`${url}a`).success).toBe(false);
	});

	test('create and bulk import can omit a link, and an empty update clears it', () => {
		const mark = { exerciseId: 'squat', value: 85000, date: '2026-11-19' };
		expect(createPRSchema.parse(mark).videoUrl).toBeUndefined();
		expect(bulkImportItemSchema.parse(mark).videoUrl).toBeUndefined();
		expect(updatePRSchema.parse({ videoUrl: '  ' }).videoUrl).toBeNull();
		expect(updatePRSchema.parse({ videoUrl: null }).videoUrl).toBeNull();
		expect(updatePRSchema.safeParse({}).success).toBe(false);
	});
});
