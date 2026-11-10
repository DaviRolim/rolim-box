import { expect, test } from '@playwright/test';
import { ATHLETE, loginToToday } from './helpers';

test.describe('Today', () => {
	test.beforeEach(async ({ page }) => {
		await loginToToday(page, ATHLETE);
	});

	test('the WoD arrives as a poster: name, format, and what is going to hurt', async ({ page }) => {
		await expect(page.getByLabel('Format: For time, Cap 10:00')).toBeVisible();
		await expect(page.getByText('Vai doer:')).toBeVisible();
		await expect(page.getByText('Thrusters', { exact: true }).first()).toBeVisible();
		await expect(page.getByText('Benchmark day.')).toBeVisible();

		// The running order follows, every section with its own block.
		await expect(page.getByRole('heading', { level: 3 })).toHaveText([
			'Warm-up',
			'Thruster build-up',
			'Fran',
			'Cool-down'
		]);
	});

	test('placar mode shows one section at a time and steps through them', async ({ page }) => {
		await page.getByRole('button', { name: 'Placar mode' }).click();
		const placar = page.getByRole('dialog', { name: /placar mode: fran/i });
		await expect(placar).toBeVisible();
		await expect(placar.getByRole('link', { name: /start clock/i })).toBeVisible();

		await placar.getByRole('button', { name: 'Next section' }).click();
		await expect(page.getByRole('dialog', { name: /placar mode: cool-down/i })).toBeVisible();

		await page.getByRole('button', { name: 'Close placar mode' }).click();
		await expect(page.getByRole('dialog')).toHaveCount(0);
	});

	test('the week strip moves between days', async ({ page }) => {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		// Stay inside the week shown; on a Sunday, tomorrow is in the next strip.
		if (tomorrow.getDay() === 1) await page.getByRole('button', { name: 'Next week' }).click();
		const label = tomorrow.toLocaleDateString('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
		await page
			.getByRole('group', { name: 'Pick a day' })
			.getByRole('button', { name: new RegExp(`^${label.replace(',', '')}`) })
			.click();

		await expect(page.getByRole('heading', { level: 1, name: 'Fran' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Back to today' }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'Fran' })).toBeVisible();
	});
});
