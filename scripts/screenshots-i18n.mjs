/**
 * The language switch, screen by screen: login, Today, the WoD editor and the timer, in English
 * and Portuguese, at phone (390x844) and desktop (1440x900).
 *
 *   bun --bun run build && bun run preview      # against a freshly seeded local.db
 *   node scripts/screenshots-i18n.mjs --base http://localhost:4173
 *
 * The language is chosen the way a person chooses it: the `rolimbox-lang` cookie the EN | PT
 * toggle writes. Form fields are found by name, so the script works in either language.
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
const OUT = args.out ?? 'screenshots/i18n';
const ONLY = args.only ? new RegExp(args.only) : null;
const PASSWORD = 'rolimbox123';
const COACH = 'davi@rolimbox.test';

mkdirSync(OUT, { recursive: true });

const seedId = (label) =>
	createHash('sha256').update(`rolimbox-seed:${label}`).digest('hex').slice(0, 32);
const isoDate = (d) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = isoDate(new Date());
const TODAY_WOD = seedId(`wod:${today}`);
const FRAN_SECTION = seedId(`section:${today}:2`);

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
const clickStart = (page) => page.locator('button.go').first().click();

const SHOTS = [
	{ name: '01-login', as: 'anon', run: (page) => go(page, '/login') },
	{
		name: '02-login-error',
		as: 'anon',
		run: async (page) => {
			await go(page, '/login');
			await page.locator('input[name="email"]').fill(COACH);
			await page.locator('input[name="password"]').fill('wrong-password');
			await page.locator('form button[type="submit"]').first().click();
			await page.getByRole('alert').first().waitFor();
		}
	},
	{ name: '10-today', as: 'coach', full: true, run: (page) => go(page, '/dashboard') },
	{ name: '20-wods-list', as: 'coach', run: (page) => go(page, '/workouts') },
	{
		name: '30-wod-editor',
		as: 'coach',
		full: true,
		run: (page) => go(page, `/workouts/${TODAY_WOD}/edit`)
	},
	{ name: '31-wod-new', as: 'coach', full: true, run: (page) => go(page, '/workouts/new') },
	{ name: '40-timers', as: 'coach', run: (page) => go(page, '/timers') },
	{
		name: '41-timer-ready',
		as: 'coach',
		run: (page) => go(page, `/timers/${FRAN_SECTION}?wod=${TODAY_WOD}`)
	},
	{
		name: '42-timer-running',
		as: 'coach',
		run: async (page) => {
			await go(page, `/timers/${FRAN_SECTION}?wod=${TODAY_WOD}`);
			await settle(page, 1200);
			await clickStart(page);
			await settle(page, 9500);
		}
	},
	{ name: '50-prs', as: 'coach', run: (page) => go(page, '/prs') },
	{ name: '60-settings', as: 'coach', run: (page) => go(page, '/settings') }
];

const browser = await chromium.launch();
const failures = [];

for (const locale of ['en', 'pt']) {
	for (const [size, device] of Object.entries(VIEWPORTS)) {
		const cookie = { name: 'rolimbox-lang', value: locale, url: BASE };

		// One warm, logged-in session per locale and viewport.
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
		await go(page, '/workouts');
		await settle(page, 2000);
		const storage = await warm.storageState({ indexedDB: true });
		await warm.close();

		for (const shot of SHOTS) {
			if (ONLY && !ONLY.test(shot.name)) continue;
			const ctx = await browser.newContext({
				...device,
				colorScheme: 'dark',
				...(shot.as === 'anon' ? {} : { storageState: storage })
			});
			await ctx.addCookies([cookie]);
			const p = await ctx.newPage();
			const file = join(OUT, `${shot.name}.${locale}.${size}.png`);
			try {
				await shot.run(p);
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
