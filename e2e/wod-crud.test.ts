import { expect, test, type Page } from '@playwright/test';
import { COACH, isoDate, loginToToday, seedId } from './helpers';

const DAY = isoDate(40);
const COPY_DAY = isoDate(41);

async function openActions(page: Page, title: string) {
	await page.getByRole('button', { name: new RegExp(`^Actions for ${title}`) }).click();
}

test.describe.serial('Programming a WoD (coach)', () => {
	test.beforeEach(async ({ page }) => {
		await loginToToday(page, COACH);
	});

	test('create a WoD with a section and a clock', async ({ page }) => {
		await page.goto(`/workouts/new?date=${DAY}`);
		await expect(page.getByRole('heading', { name: 'New WoD' })).toBeVisible();
		await expect(page.getByLabel('Date')).toHaveValue(DAY);

		await page.getByLabel("Coach's brief").fill('Test day. Short and sharp.');
		await page.getByRole('button', { name: 'Add section', exact: true }).click();

		const name = page.getByLabel('Name', { exact: true });
		await expect(name).toBeFocused();
		await name.fill('Zebra');
		await page.getByLabel('Type of section 1').selectOption('wod');
		await page.getByLabel(/what's on the board/i).fill('150 wall balls (9/6 kg)');
		await page.getByRole('radio', { name: 'FOR TIME' }).click();
		await page.getByLabel('Cap (min)').fill('12');

		// The live preview already shows what athletes will get.
		await page.getByRole('tab', { name: 'Preview' }).click();
		await expect(page.getByLabel('Format: For time, Cap 12:00')).toBeVisible();

		await page.getByRole('button', { name: 'Save WoD' }).first().click();
		await expect(page).toHaveURL(/\/workouts$/);
		await expect(page.getByRole('status').filter({ hasText: 'WoD saved' })).toBeVisible();
		await expect(page.getByRole('link', { name: /Zebra/ })).toBeVisible();
	});

	test('saving needs at least one named section', async ({ page }) => {
		await page.goto('/workouts/new');
		await page.getByRole('button', { name: 'Save WoD' }).first().click();
		await expect(page.getByText('Add at least one section.').first()).toBeVisible();
		await expect(page).toHaveURL(/\/workouts\/new/);
	});

	test('the saved WoD reached the server and can be edited', async ({ page }) => {
		await page.goto('/workouts');
		await page.getByRole('link', { name: /Zebra/ }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'Zebra' })).toBeVisible();
		await expect(page.getByText('Test day. Short and sharp.')).toBeVisible();

		await page.getByRole('link', { name: 'Edit' }).click();
		await expect(page.getByRole('heading', { name: 'Edit WoD' })).toBeVisible();
		await page.getByLabel('Name', { exact: true }).fill('Zebra II');
		await page.getByRole('button', { name: 'Save', exact: true }).click();

		await expect(page).toHaveURL(/\/workouts$/);
		await expect(page.getByRole('link', { name: /Zebra II/ })).toBeVisible();

		// A fresh browser profile only knows what the server has.
		const response = await page.request.get(
			`/api/wods?workspaceId=${seedId('workspace:rolimbox')}&limit=100`
		);
		const { wods } = await response.json();
		const saved = wods.find((w: { date: string }) => w.date === DAY);
		expect(saved?.sections[0]?.name).toBe('Zebra II');
		expect(JSON.parse(saved.sections[0].timerConfig)).toEqual({ type: 'fortime', duration: 720 });
	});

	test('duplicate it onto another day', async ({ page }) => {
		await page.goto('/workouts');
		await openActions(page, 'Zebra II');
		await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
		await page.getByLabel('Copy to').fill(COPY_DAY);
		await page.getByRole('button', { name: 'Duplicate WoD' }).click();

		await expect(page.getByRole('link', { name: /Zebra II/ })).toHaveCount(2);
	});

	test('delete both', async ({ page }) => {
		await page.goto('/workouts');
		for (const remaining of [1, 0]) {
			await page
				.getByRole('button', { name: /^Actions for Zebra II/ })
				.first()
				.click();
			await page.getByRole('button', { name: 'Delete', exact: true }).click();
			await page.getByRole('button', { name: 'Delete WoD' }).click();
			await expect(page.getByRole('link', { name: /Zebra II/ })).toHaveCount(remaining);
		}
	});

	test('the Magic Wand explains itself when the server has no key', async ({ page }) => {
		await page.goto('/workouts/new');
		const wand = page.getByRole('button', { name: 'Magic Wand' });
		await expect(wand).toBeDisabled();

		await page.getByLabel("Coach's brief").fill('Heavy front squats, then a 12 minute AMRAP.');
		await wand.click();
		await expect(page.getByText(/Magic Wand is not set up on this server/)).toBeVisible();

		// Nothing is blocked: sections can still be written by hand.
		await page.getByRole('button', { name: 'Add section', exact: true }).click();
		await expect(page.getByLabel('Name', { exact: true })).toBeVisible();
	});

	test('leaving with unsaved changes asks first', async ({ page }) => {
		await page.goto('/workouts/new');
		await page.getByLabel("Coach's brief").fill('Do not lose me.');
		await page.getByRole('link', { name: 'Back' }).click();

		await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible();
		await page.getByRole('button', { name: 'Keep editing' }).click();
		await expect(page.getByLabel("Coach's brief")).toHaveValue('Do not lose me.');
	});
});
