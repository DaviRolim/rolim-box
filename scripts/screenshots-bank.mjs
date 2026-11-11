/**
 * The WoD bank, screen by screen: the list, the editor in bank mode (a quick idea and a full
 * bank WoD), the schedule step and saving a dated WoD into the bank, in English and
 * Portuguese, at phone (390x844) and desktop (1440x900).
 *
 *   bun --bun run build && bun run preview      # against a freshly seeded local.db
 *   node scripts/screenshots-bank.mjs --base http://localhost:4173
 *
 * The language is set with the `rolimbox-lang` cookie, as the EN | PT toggle does, and
 * elements are found by id or by seeded names, so the script works in either language.
 */
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(
	process.argv
		.slice(2)
		.map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : null))
		.filter(Boolean)
);
const BASE = args.base ?? 'http://localhost:4173';
const OUT = args.out ?? 'screenshots/bank';
const ONLY = args.only ? new RegExp(args.only) : null;
const PASSWORD = 'rolimbox123';
const COACH = 'davi@rolimbox.test';

mkdirSync(OUT, { recursive: true });

const seedId = (label) =>
	createHash('sha256').update(`rolimbox-seed:${label}`).digest('hex').slice(0, 32);
const isoDate = (d) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TODAY_WOD = seedId(`wod:${isoDate(new Date())}`);
const DANILO_EMOM = seedId('bank:emomDanilo');

const VIEWPORTS = {
	phone: {
		viewport: { width: 390, height: 844 },
		deviceScaleFactor: 2,
		isMobile: true,
		hasTouch: true
	},
	desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
};

const settle = (page, ms = 700) => page.waitForTimeout(ms);
const go = (page, path) => page.goto(`${BASE}${path}`, { waitUntil: 'load' });
const row = (page, name) => page.locator('li.row', { hasText: name });

const SHOTS = [
	{
		name: '10-bank-list',
		full: true,
		run: async (page) => {
			await go(page, '/bank');
			await row(page, 'Filthy Fifty').waitFor();
		}
	},
	{
		name: '20-editor-new-idea',
		full: true,
		run: async (page, size) => {
			await go(page, '/bank/new');
			await page.locator('#bank-name').fill('Sandbag Saturday');
			await page
				.locator('#wod-brief')
				.fill(
					'Partner chipper with the sandbags: carries, cleans over the shoulder, a long run in the middle.'
				);
			if (size === 'phone') await page.evaluate(() => window.scrollTo(0, 0));
		}
	},
	{
		name: '21-editor-bank-wod',
		full: true,
		run: async (page) => {
			await go(page, `/bank/${DANILO_EMOM}`);
			await page.locator('#bank-name').waitFor();
		}
	},
	{
		name: '30-schedule',
		run: async (page, size) => {
			await go(page, '/bank');
			const target = row(page, "Danilo's EMOM");
			await target.waitFor();
			await target.locator(size === 'phone' ? 'button.put' : '.tools button.btn').click();
			await page.locator('#schedule-date').waitFor();
		}
	},
	{
		name: '40-save-to-bank',
		run: async (page) => {
			await go(page, `/workouts/${TODAY_WOD}`);
			await page
				.locator('button:has(svg)', { hasText: /bank|banco/i })
				.first()
				.click();
			await page.locator('#save-to-bank-name').waitFor();
		}
	}
];

const browser = await chromium.launch();
const failures = [];

for (const locale of ['en', 'pt']) {
	for (const [size, device] of Object.entries(VIEWPORTS)) {
		const cookie = { name: 'rolimbox-lang', value: locale, url: BASE };

		const warm = await browser.newContext({ ...device, colorScheme: 'dark' });
		await warm.addCookies([cookie]);
		const page = await warm.newPage();
		await go(page, '/login');
		await page.locator('input[name="email"]').fill(COACH);
		await page.locator('input[name="password"]').fill(PASSWORD);
		await page.locator('form button[type="submit"]').first().click();
		await page.waitForURL(/dashboard/);
		await page.request.post(`${BASE}/api/workspaces/active`, {
			data: { workspaceId: seedId('workspace:rolimbox') }
		});
		await go(page, '/bank');
		await settle(page, 2000);
		const storage = await warm.storageState({ indexedDB: true });
		await warm.close();

		for (const shot of SHOTS) {
			if (ONLY && !ONLY.test(shot.name)) continue;
			const ctx = await browser.newContext({
				...device,
				colorScheme: 'dark',
				storageState: storage
			});
			await ctx.addCookies([cookie]);
			const p = await ctx.newPage();
			const file = join(OUT, `${shot.name}.${locale}.${size}.png`);
			try {
				await shot.run(p, size);
				await settle(p, 1200);
				await p.screenshot({ path: file, fullPage: !!shot.full && size === 'phone' });
				console.log('✓', file);
			} catch (error) {
				failures.push(file);
				console.error('✗', file, error.message);
			}
			await ctx.close();
		}
	}
}

await browser.close();
if (failures.length) {
	console.error(`${failures.length} shot(s) failed`);
	process.exit(1);
}
