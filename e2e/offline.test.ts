import { expect, test } from '@playwright/test';
import { ATHLETE, COACH, appInstalled, isoDate, loginToToday, seedId } from './helpers';

test.describe('Without a connection', () => {
	test('the installed app is a valid PWA shell', async ({ page }) => {
		const manifest = await (await page.request.get('/manifest.json')).json();
		expect(manifest.display).toBe('standalone');
		expect(manifest.start_url).toBe('/dashboard');
		expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(
			true
		);
		for (const icon of manifest.icons) {
			expect((await page.request.get(icon.src)).ok()).toBe(true);
		}
		expect((await page.request.get('/service-worker.js')).ok()).toBe(true);
	});

	test("today's WoD, the list and the clock keep working offline, even after a reload", async ({
		page,
		context
	}) => {
		await loginToToday(page, ATHLETE);

		// Wait for the service worker to take over and keep its copy of Today.
		await appInstalled(page);
		await page.reload();
		await expect(page.getByRole('heading', { level: 1, name: 'Fran' })).toBeVisible();
		await page.waitForFunction(async () => {
			const keys = await caches.keys();
			const pages = keys.find((key) => key.startsWith('rolimbox-pages'));
			return pages ? !!(await (await caches.open(pages)).match('/dashboard')) : false;
		});

		await context.setOffline(true);

		// Moving around inside the app needs no network.
		await expect(page.getByText('Offline. Showing what is saved on this phone.')).toBeVisible();
		await page.getByRole('link', { name: 'WoDs', exact: true }).click();
		await expect(page.getByRole('link', { name: /^Fran/ })).toBeVisible();
		await page.getByRole('link', { name: 'Clock', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible();

		// Closing and reopening the app offline still lands on today's WoD.
		await page.goto('/dashboard');
		await expect(page.getByRole('heading', { level: 1, name: 'Fran' })).toBeVisible();

		// A page never opened before falls back to Today instead of a browser error.
		await page.goto('/prs');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

		await context.setOffline(false);
	});

	test('a WoD written offline is kept and sent when the connection returns', async ({
		page,
		context
	}) => {
		await loginToToday(page, COACH);
		const day = isoDate(50);

		await appInstalled(page);
		await page.goto(`/workouts/new?date=${day}`);
		await expect(page.getByLabel('Date')).toHaveValue(day);
		await page.waitForLoadState('networkidle');
		await context.setOffline(true);

		await page.getByRole('button', { name: 'Add section', exact: true }).click();
		await page.getByLabel('Name', { exact: true }).fill('Offline Annie');
		await page.getByLabel(/what's on the board/i).fill('50-40-30-20-10\nDouble-unders\nSit-ups');
		await page.getByRole('button', { name: 'Save WoD' }).first().click();

		await expect(page).toHaveURL(/\/workouts$/);
		await expect(page.getByRole('link', { name: /Offline Annie/ })).toBeVisible();
		await expect(page.getByRole('link', { name: /sync status: offline/i })).toBeVisible();

		await context.setOffline(false);
		await expect(page.getByRole('link', { name: /sync status: synced/i })).toBeVisible({
			timeout: 15_000
		});

		const workspaceId = seedId('workspace:rolimbox');
		const { wods } = await (
			await page.request.get(`/api/wods?workspaceId=${workspaceId}&limit=100`)
		).json();
		const saved = wods.find((w: { date: string }) => w.date === day);
		expect(saved?.sections[0]?.name).toBe('Offline Annie');

		// Tidy up so the list is as the seed left it.
		await page.request.delete(`/api/wods/${saved.id}`);
	});
});
