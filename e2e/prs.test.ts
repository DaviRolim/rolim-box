import { expect, test } from '@playwright/test';
import { ATHLETE, loginToToday } from './helpers';

test.describe('PRs', () => {
	test.beforeEach(async ({ page }) => {
		await loginToToday(page, ATHLETE);
		await page.goto('/prs');
	});

	test("the athlete's own records are listed and searchable", async ({ page }) => {
		await expect(page.getByRole('tab', { name: 'My PRs' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByRole('button', { name: /Back Squat/ })).toContainText('85');

		await page.getByRole('searchbox').fill('fran');
		await expect(page.getByRole('button', { name: /Fran/ })).toContainText('5:31');
		await expect(page.getByRole('button', { name: /Back Squat/ })).toHaveCount(0);
	});

	test('the leaderboard ranks the box and marks you', async ({ page }) => {
		await page.getByRole('tab', { name: 'Leaderboard' }).click();
		await expect(page.getByText('Box ranking')).toBeVisible();
		await expect(page.getByText('Danilo').first()).toBeVisible();
		await expect(page.getByText('You', { exact: true }).first()).toBeVisible();
	});

	test('an exercise opens with its history', async ({ page }) => {
		await page.getByRole('button', { name: /Back Squat/ }).click();
		const sheet = page.getByRole('dialog', { name: /Back Squat/ });
		await expect(sheet).toBeVisible();
		await expect(sheet.getByText('85').first()).toBeVisible();
	});
});
