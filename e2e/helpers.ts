import { expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';

export const PASSWORD = 'rolimbox123';
export const COACH = 'davi@rolimbox.test';
export const ATHLETE = 'bia@rolimbox.test';

/** The seed derives its ids from labels, so tests can address seeded rows directly. */
export const seedId = (label: string) =>
	createHash('sha256').update(`rolimbox-seed:${label}`).digest('hex').slice(0, 32);

export function isoDate(offsetDays = 0): string {
	const d = new Date();
	d.setDate(d.getDate() + offsetDays);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const TODAY_WOD = seedId(`wod:${isoDate()}`);
export const FRAN_SECTION = seedId(`section:${isoDate()}:2`);
export const EMOM_SECTION = seedId(`section:${isoDate()}:1`);

export async function login(page: Page, email: string, password = PASSWORD) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
}

/** Wait until the service worker has stored the app and controls this page. */
export async function appInstalled(page: Page) {
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) {
			await new Promise((resolve) =>
				navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
			);
		}
	});
}

/** Log in and wait for today's board to be on screen. */
export async function loginToToday(page: Page, email: string) {
	await login(page, email);
	await page.waitForURL('**/dashboard');
	// The coach belongs to two boxes; make sure the one with the WoDs is active.
	await page.request.post('/api/workspaces/active', {
		data: { workspaceId: seedId('workspace:rolimbox') }
	});
	await page.goto('/dashboard');
	await expect(page.getByRole('heading', { level: 1, name: 'Fran' })).toBeVisible();
}
