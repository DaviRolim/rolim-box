/**
 * Capture the main screens and states at phone (390x844) and desktop (1440x900).
 *
 *   node scripts/screenshots.mjs --out screenshots/before --base http://localhost:5173 --variant before
 *   node scripts/screenshots.mjs --out screenshots/revamp --base http://localhost:4173 --variant after
 *
 * Expects a freshly seeded local database (bun run db:seed) so "today" has a WoD.
 * The same shot names are produced for both variants so they can be compared side by side.
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
const BASE = args.base ?? 'http://localhost:5173';
const OUT = args.out ?? 'screenshots/before';
const VARIANT = args.variant ?? 'before';
const ONLY = args.only ? new RegExp(args.only) : null;
const PASSWORD = 'rolimbox123';

mkdirSync(OUT, { recursive: true });

const seedId = (label) =>
	createHash('sha256').update(`rolimbox-seed:${label}`).digest('hex').slice(0, 32);
const isoDate = (d) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = isoDate(new Date());
const TODAY_WOD = seedId(`wod:${today}`);
const FRAN_SECTION = seedId(`section:${today}:2`); // "Fran", for time
const EMOM_SECTION = seedId(`section:${today}:1`); // thruster EMOM

const VIEWPORTS = {
	phone: {
		viewport: { width: 390, height: 844 },
		deviceScaleFactor: 2,
		isMobile: true,
		hasTouch: true
	},
	desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
};

const USERS = {
	coach: 'davi@rolimbox.test',
	athlete: 'bia@rolimbox.test',
	novato: 'novato@rolimbox.test'
};

const settle = (page, ms = 700) => page.waitForTimeout(ms);

/** page.goto with a few retries: the Vite dev server reloads pages while it optimises deps. */
async function go(page, url) {
	for (let attempt = 0; ; attempt++) {
		try {
			return await page.goto(url, { waitUntil: 'load' });
		} catch (error) {
			if (attempt >= 3) throw error;
			await page.waitForTimeout(800);
		}
	}
}

/** Switch the active workspace through the API (shares cookies with the page's context). */
async function setActiveWorkspace(page, workspaceId) {
	const res = await page.context().request.post(`${BASE}/api/workspaces/active`, {
		data: { workspaceId }
	});
	if (!res.ok()) throw new Error(`Could not switch workspace: ${res.status()}`);
}

// ---------------------------------------------------------------------------
// Variant-specific interactions (the DOM differs before and after the revamp)
// ---------------------------------------------------------------------------

const before = {
	async login(page, email, password = PASSWORD) {
		await go(page, `${BASE}/login`);
		await page.fill('#email', email);
		await page.fill('#password', password);
		await page.click('button[type="submit"]');
	},
	async openAddSection(page) {
		await page
			.getByRole('button', { name: /add section/i })
			.first()
			.click();
	},
	async fillDescription(page, text) {
		await page.fill('#workout-description', text);
	},
	async clickWand(page) {
		await page.click('button[title="AI Intelligence"]');
	},
	async timerStart(page) {
		await page.getByRole('button', { name: /^start$/i }).click();
	},
	async timerPause(page) {
		await page.getByRole('button', { name: /pause/i }).click();
	},
	async timerFinish(page) {
		await page.getByRole('button', { name: /finish|stop/i }).click();
	},
	async selectTimerType(page, label) {
		await page.locator('button.type-btn', { hasText: label }).click();
	},
	async startStandalone(page) {
		await page.getByRole('button', { name: /start workout timer/i }).click();
	},
	async openLeaderboard(page) {
		await page.getByRole('button', { name: /leaderboard/i }).click();
	},
	async switchToEmptyWorkspace(page) {
		// The switcher is hidden on phones in the old UI, so call the API directly.
		await setActiveWorkspace(page, seedId('workspace:kids'));
	},
	async switchToMainWorkspace(page) {
		await setActiveWorkspace(page, seedId('workspace:rolimbox'));
	},
	async openDuplicate(page) {
		await page.locator('button[title="Duplicate"]').first().click();
	},
	async openDelete(page) {
		await page.locator('button[title="Delete"]').first().click();
	}
};

const after = {
	...before,
	async login(page, email, password = PASSWORD) {
		await go(page, `${BASE}/login`);
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password', { exact: true }).fill(password);
		await page.getByRole('button', { name: /^log in$/i }).click();
	},
	async openAddSection(page) {
		await page.getByRole('button', { name: /^add section$/i }).click();
	},
	async fillDescription(page, text) {
		await page.getByLabel(/coach.s brief/i).fill(text);
	},
	async clickWand(page) {
		await page.getByRole('button', { name: /magic wand/i }).click();
	},
	async timerStart(page) {
		await page.getByRole('button', { name: /^start$/i }).click();
	},
	async timerPause(page) {
		await page.getByRole('button', { name: /^pause$/i }).click();
	},
	async timerFinish(page) {
		await page.getByRole('button', { name: /^(finish|end)/i }).click();
	},
	async selectTimerType(page, label) {
		await page.getByRole('radio', { name: new RegExp(`^${label}`, 'i') }).click();
	},
	async startStandalone(page) {
		await page.getByRole('button', { name: /^start timer$/i }).click();
	},
	async openLeaderboard(page) {
		await page.getByRole('tab', { name: /leaderboard/i }).click();
	},
	async openDuplicate(page) {
		await page
			.getByRole('button', { name: /^duplicate/i })
			.first()
			.click();
	},
	async openDelete(page) {
		await page
			.getByRole('button', { name: /^delete/i })
			.first()
			.click();
	}
};

const A = VARIANT === 'after' ? after : before;

// ---------------------------------------------------------------------------
// Shots
// ---------------------------------------------------------------------------

/** @type {{name: string, as: keyof typeof USERS | 'anon', full?: boolean, fresh?: boolean, run: (page: import('@playwright/test').Page, ctx: import('@playwright/test').BrowserContext) => Promise<void>, cleanup?: (page: import('@playwright/test').Page) => Promise<void>}[]} */
const SHOTS = [
	// --- Auth -------------------------------------------------------------
	{
		name: '01-login',
		as: 'anon',
		run: async (page) => {
			await go(page, `${BASE}/login`);
			await settle(page);
		}
	},
	{
		name: '02-login-error',
		as: 'anon',
		run: async (page) => {
			await A.login(page, USERS.coach, 'wrong-password');
			await settle(page, 1200);
		}
	},
	{
		name: '03-register',
		as: 'anon',
		run: async (page) => {
			await go(page, `${BASE}/register`);
			await settle(page);
		}
	},
	{
		name: '04-join-invite',
		as: 'anon',
		run: async (page) => {
			await go(page, `${BASE}/join/RLM-B2X`);
			await settle(page);
		}
	},
	{
		name: '05-join-expired',
		as: 'anon',
		run: async (page) => {
			await go(page, `${BASE}/join/EXP-222`);
			await settle(page);
		}
	},
	{
		name: '06-no-workspace',
		as: 'novato',
		run: async (page) => {
			await go(page, `${BASE}/dashboard`);
			await settle(page);
		}
	},

	// --- Today ------------------------------------------------------------
	{
		name: '10-today-first-load',
		as: 'coach',
		fresh: true, // brand new browser profile: nothing in the local cache yet
		run: async (page) => {
			await settle(page, 2500);
		}
	},
	{
		name: '11-today-coach',
		as: 'coach',
		full: true,
		run: async (page) => {
			await go(page, `${BASE}/dashboard`);
			await settle(page, 1200);
		}
	},
	{
		name: '12-today-athlete',
		as: 'athlete',
		full: true,
		run: async (page) => {
			await go(page, `${BASE}/dashboard`);
			await settle(page, 1200);
		}
	},
	{
		name: '13-today-loading',
		as: 'coach',
		run: async (page) => {
			// Hold IndexedDB closed for a few seconds so the loading state is visible.
			await page.addInitScript(() => {
				const add = IDBRequest.prototype.addEventListener;
				IDBRequest.prototype.addEventListener = function (type, listener, opts) {
					if (this instanceof IDBOpenDBRequest && type === 'success') {
						const delayed = (ev) => setTimeout(() => listener.call(this, ev), 6000);
						return add.call(this, type, delayed, opts);
					}
					return add.call(this, type, listener, opts);
				};
			});
			await go(page, `${BASE}/dashboard`);
			await settle(page, 1500);
		}
	},
	{
		name: '14-today-offline',
		as: 'coach',
		run: async (page, ctx) => {
			await go(page, `${BASE}/dashboard`);
			await settle(page, 1200);
			await ctx.setOffline(true);
			await settle(page, 1000);
		}
	},
	{
		name: '15-today-empty',
		as: 'coach',
		run: async (page) => {
			await go(page, `${BASE}/dashboard`);
			await A.switchToEmptyWorkspace(page);
			await go(page, `${BASE}/dashboard`);
			await settle(page, 1500);
		},
		cleanup: async (page) => {
			await A.switchToMainWorkspace(page);
		}
	},

	// --- WoD list / detail ---------------------------------------------------
	{
		name: '20-wods-list',
		as: 'coach',
		full: true,
		run: async (page) => {
			await go(page, `${BASE}/workouts`);
			await settle(page, 1500);
		}
	},
	{
		name: '21-wods-list-athlete',
		as: 'athlete',
		run: async (page) => {
			await go(page, `${BASE}/workouts`);
			await settle(page, 1500);
		}
	},
	{
		name: '22-wods-list-empty',
		as: 'coach',
		run: async (page) => {
			await go(page, `${BASE}/workouts`);
			await A.switchToEmptyWorkspace(page);
			await go(page, `${BASE}/workouts`);
			await settle(page, 1500);
		},
		cleanup: async (page) => {
			await A.switchToMainWorkspace(page);
		}
	},
	{
		name: '23-wod-duplicate-dialog',
		as: 'coach',
		run: async (page) => {
			await go(page, `${BASE}/workouts`);
			await settle(page, 1500);
			await A.openDuplicate(page);
			await settle(page, 600);
		}
	},
	{
		name: '24-wod-delete-dialog',
		as: 'coach',
		run: async (page) => {
			await go(page, `${BASE}/workouts`);
			await settle(page, 1500);
			await A.openDelete(page);
			await settle(page, 600);
		}
	},
	{
		name: '25-wod-detail',
		as: 'coach',
		full: true,
		run: async (page) => {
			await go(page, `${BASE}/workouts/${TODAY_WOD}`);
			await settle(page, 1500);
		}
	},
	{
		name: '26-wod-detail-athlete',
		as: 'athlete',
		run: async (page) => {
			await go(page, `${BASE}/workouts/${TODAY_WOD}`);
			await settle(page, 1500);
		}
	},
	{
		name: '27-wod-not-found',
		as: 'coach',
		run: async (page) => {
			await go(page, `${BASE}/workouts/does-not-exist`);
			await settle(page, 1800);
		}
	},

	// --- Create / edit (coach) ----------------------------------------------
	{
		name: '30-wod-new',
		as: 'coach',
		run: async (page) => {
			await go(page, `${BASE}/workouts/new`);
			await settle(page, 1000);
		}
	},
	{
		name: '31-wod-new-add-section',
		as: 'coach',
		full: true,
		run: async (page) => {
			await go(page, `${BASE}/workouts/new`);
			await settle(page, 800);
			await A.fillDescription(page, 'Heavy front squats, then a 12 minute AMRAP with wall balls.');
			await A.openAddSection(page);
			await settle(page, 600);
		}
	},
	{
		name: '32-wod-new-magic-wand-no-key',
		as: 'coach',
		run: async (page) => {
			await go(page, `${BASE}/workouts/new`);
			await settle(page, 800);
			await A.fillDescription(page, 'Heavy front squats, then a 12 minute AMRAP with wall balls.');
			await settle(page, 300);
			await A.clickWand(page);
			await settle(page, 2500);
		}
	},
	{
		name: '33-wod-edit',
		as: 'coach',
		full: true,
		run: async (page) => {
			await go(page, `${BASE}/workouts/${TODAY_WOD}/edit`);
			await settle(page, 1500);
		}
	},

	// --- Timers -----------------------------------------------------------
	{
		name: '40-timers-config-amrap',
		as: 'athlete',
		run: async (page) => {
			await go(page, `${BASE}/timers`);
			await settle(page, 800);
		}
	},
	{
		name: '41-timers-config-tabata',
		as: 'athlete',
		run: async (page) => {
			await go(page, `${BASE}/timers`);
			await settle(page, 500);
			await A.selectTimerType(page, 'TABATA');
			await settle(page, 400);
		}
	},
	{
		name: '42-timer-ready',
		as: 'athlete',
		run: async (page) => {
			await go(page, `${BASE}/timers/${FRAN_SECTION}?wod=${TODAY_WOD}`);
			await settle(page, 1500);
		}
	},
	{
		name: '43-timer-countdown',
		as: 'athlete',
		run: async (page) => {
			await go(page, `${BASE}/timers/${FRAN_SECTION}?wod=${TODAY_WOD}`);
			await settle(page, 1500);
			await A.timerStart(page);
			await settle(page, 1300);
		}
	},
	{
		name: '44-timer-running-fortime',
		as: 'athlete',
		run: async (page) => {
			await go(page, `${BASE}/timers/${FRAN_SECTION}?wod=${TODAY_WOD}`);
			await settle(page, 1500);
			await A.timerStart(page);
			await settle(page, 9500);
		}
	},
	{
		name: '45-timer-paused',
		as: 'athlete',
		run: async (page) => {
			await go(page, `${BASE}/timers/${FRAN_SECTION}?wod=${TODAY_WOD}`);
			await settle(page, 1500);
			await A.timerStart(page);
			await settle(page, 6500);
			await A.timerPause(page);
			await settle(page, 500);
		}
	},
	{
		name: '46-timer-finished',
		as: 'athlete',
		run: async (page) => {
			await go(page, `${BASE}/timers/${FRAN_SECTION}?wod=${TODAY_WOD}`);
			await settle(page, 1500);
			await A.timerStart(page);
			await settle(page, 7500);
			if (VARIANT === 'after') await A.timerPause(page);
			await A.timerFinish(page);
			await settle(page, 800);
		}
	},
	{
		name: '47-timer-running-emom',
		as: 'athlete',
		run: async (page) => {
			await go(page, `${BASE}/timers/${EMOM_SECTION}?wod=${TODAY_WOD}`);
			await settle(page, 1500);
			await A.timerStart(page);
			await settle(page, 8500);
		}
	},
	{
		name: '48-timer-running-tabata',
		as: 'athlete',
		run: async (page) => {
			await go(page, `${BASE}/timers?type=tabata`);
			await settle(page, 600);
			await A.startStandalone(page);
			// 3-2-1-go, then 20s of work: capture the rest phase.
			await settle(page, 3600 + 20000 + 4000);
		}
	},
	{
		name: '49-timer-running-amrap',
		as: 'athlete',
		run: async (page) => {
			await go(page, `${BASE}/timers?type=amrap`);
			await settle(page, 600);
			await A.startStandalone(page);
			await settle(page, 9000);
		}
	},

	// --- PRs / settings ---------------------------------------------------
	{
		name: '50-prs',
		as: 'athlete',
		run: async (page) => {
			await go(page, `${BASE}/prs`);
			await settle(page, 2000);
		}
	},
	{
		name: '51-prs-leaderboard',
		as: 'athlete',
		run: async (page) => {
			await go(page, `${BASE}/prs`);
			await settle(page, 1500);
			await A.openLeaderboard(page);
			await settle(page, 2000);
		}
	},
	{
		name: '60-settings',
		as: 'coach',
		run: async (page) => {
			await go(page, `${BASE}/settings`);
			await settle(page, 800);
		}
	},
	{
		name: '61-settings-workspace',
		as: 'coach',
		full: true,
		run: async (page) => {
			await go(page, `${BASE}/settings/workspace`);
			await settle(page, 800);
		}
	},

	// --- Errors -----------------------------------------------------------
	{
		name: '70-not-found',
		as: 'coach',
		run: async (page) => {
			await go(page, `${BASE}/this-page-does-not-exist`);
			await settle(page, 800);
		}
	}
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const browser = await chromium.launch();
const failures = [];

for (const [size, device] of Object.entries(VIEWPORTS)) {
	// One warm, logged-in storage state per user and viewport.
	const states = {};
	for (const [role, email] of Object.entries(USERS)) {
		const ctx = await browser.newContext(device);
		const page = await ctx.newPage();
		await A.login(page, email);
		await page.waitForURL(/dashboard|no-workspace|workouts/, { timeout: 15000 });
		await page.waitForLoadState('networkidle');
		// Visit the lists once so the local cache is warm, like a returning user.
		if (role !== 'novato') {
			// The coach belongs to two workspaces; make sure the box itself is the active one.
			if (role === 'coach') await A.switchToMainWorkspace(page);
			await go(page, `${BASE}/workouts`);
			await settle(page, 2500);
			await go(page, `${BASE}/dashboard`);
			await settle(page, 1500);
		}
		states[role] = { ctx, storage: await ctx.storageState({ indexedDB: true }) };
		await ctx.close();
	}

	for (const shot of SHOTS) {
		if (ONLY && !ONLY.test(shot.name)) continue;
		const ctx = await browser.newContext({
			...device,
			...(shot.as !== 'anon' && !shot.fresh ? { storageState: states[shot.as].storage } : {})
		});
		const page = await ctx.newPage();
		const file = join(OUT, `${shot.name}.${size}.png`);
		try {
			if (shot.fresh) {
				await A.login(page, USERS[shot.as]);
				await page.waitForURL(/dashboard|no-workspace|workouts/, { timeout: 15000 });
				await page.waitForLoadState('networkidle');
				if (shot.as === 'coach') {
					await A.switchToMainWorkspace(page);
					// Start again from an empty local cache, now on the right workspace.
					await page.evaluate(
						() =>
							new Promise((resolve) => {
								const req = indexedDB.deleteDatabase('rolimbox');
								req.onsuccess = req.onerror = req.onblocked = () => resolve(null);
							})
					);
					await go(page, `${BASE}/dashboard`);
				}
			}
			await shot.run(page, ctx);
			await page.screenshot({ path: file, animations: 'disabled' });
			if (shot.full) {
				await page.screenshot({
					path: join(OUT, `${shot.name}.${size}.full.png`),
					fullPage: true,
					animations: 'disabled'
				});
			}
			console.log(`ok   ${file}`);
		} catch (error) {
			failures.push(`${shot.name}.${size}: ${error.message.split('\n')[0]}`);
			console.log(`FAIL ${file}: ${error.message.split('\n')[0]}`);
			await page.screenshot({ path: file, animations: 'disabled' }).catch(() => {});
		} finally {
			if (shot.cleanup) {
				await ctx.setOffline(false);
				await shot.cleanup(page).catch(() => {});
			}
			await ctx.close();
		}
	}
}

await browser.close();

if (failures.length) {
	console.log(`\n${failures.length} shot(s) had problems:\n  ${failures.join('\n  ')}`);
	process.exitCode = 1;
}
