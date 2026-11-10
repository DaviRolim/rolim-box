import { expect, test } from '@playwright/test';
import { ATHLETE, EMOM_SECTION, FRAN_SECTION, TODAY_WOD, loginToToday } from './helpers';

test.describe('The clock', () => {
	test.beforeEach(async ({ page }) => {
		await loginToToday(page, ATHLETE);
	});

	test('set up any format with the big keys', async ({ page }) => {
		await page.goto('/timers');
		await expect(page.getByRole('radio', { name: /^AMRAP/ })).toBeChecked();

		const minutes = page.getByLabel('Minutes', { exact: true });
		await expect(minutes).toHaveValue('20');
		await page.getByRole('button', { name: 'More minutes' }).click();
		await expect(minutes).toHaveValue('21');
		await page.getByRole('button', { name: 'Less minutes' }).click();
		await expect(minutes).toHaveValue('20');

		await page.getByRole('radio', { name: /^EMOM/ }).click();
		await expect(page.getByLabel('Rounds', { exact: true })).toBeVisible();
		await expect(page.getByLabel('Every', { exact: true })).toBeVisible();

		await page.getByRole('radio', { name: /^TABATA/ }).click();
		await expect(page.getByLabel('Work', { exact: true })).toHaveValue('20');
		await expect(page.getByLabel('Rest', { exact: true })).toHaveValue('10');
		await expect(page.getByText('8 × 20s / 10s')).toBeVisible();

		await page.getByRole('radio', { name: /^FOR TIME/ }).click();
		await expect(page.getByLabel('Time cap', { exact: true })).toHaveValue('15');
	});

	test('a standalone AMRAP counts down, counts rounds, pauses and ends', async ({ page }) => {
		await page.goto('/timers');
		await page.getByRole('button', { name: 'Start timer' }).click();
		await expect(page).toHaveURL(/\/timers\/standalone$/);

		// 3-2-1, then the clock runs down from 20:00.
		const clock = page.getByRole('timer');
		await expect(clock).toHaveAccessibleName(/^19 minutes 5\d seconds$/, { timeout: 10_000 });

		await page.getByRole('button', { name: 'Count one round' }).click();
		await page.getByRole('button', { name: 'Count one round' }).click();
		await page.getByRole('button', { name: 'Take one round back' }).click();

		await page.getByRole('button', { name: 'Pause' }).click();
		await expect(page.getByText('Paused')).toBeVisible();
		const frozen = await clock.getAttribute('aria-label');
		await page.waitForTimeout(1300);
		await expect(clock).toHaveAttribute('aria-label', frozen!);

		await page.getByRole('button', { name: 'Resume' }).click();
		await page.getByRole('button', { name: 'Pause' }).click();
		await page.getByRole('button', { name: 'End here' }).click();

		// The finish line.
		await expect(page.getByText('Acabou!')).toBeVisible();
		await expect(page.getByRole('status', { name: /^Result: 1 round$/ })).toBeVisible();
		await expect(page.getByRole('button', { name: /share result/i })).toBeVisible();

		await page.getByRole('button', { name: 'Done' }).click();
		await expect(page).toHaveURL(/\/timers$/);

		// Going back with the browser shows the same clock waiting, it does not start by itself.
		await page.goBack();
		await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
		await page.waitForTimeout(1500);
		await expect(page.getByRole('timer')).toHaveAccessibleName('20 minutes 00 seconds');
	});

	test("a WoD's own clock shows the workout, then the time you finished in", async ({ page }) => {
		await page.goto(`/timers/${FRAN_SECTION}?wod=${TODAY_WOD}`);
		await expect(page.getByRole('heading', { level: 1, name: 'Fran' })).toBeVisible();
		await expect(page.getByText('Thrusters (43/30 kg)')).toBeVisible();

		await page.getByRole('button', { name: 'Start', exact: true }).click();
		const clock = page.getByRole('timer');
		await expect(clock).toHaveAccessibleName(/^00 minutes 0[2-9] seconds$/, { timeout: 12_000 });

		await page.getByRole('button', { name: 'Finish' }).click();
		await expect(page.getByText('Acabou!')).toBeVisible();
		await expect(page.getByRole('status', { name: /^Result: 00:0\d Time$/ })).toBeVisible();

		await page.getByRole('button', { name: 'Back to WoD' }).click();
		await expect(page).toHaveURL(new RegExp(`/workouts/${TODAY_WOD}$`));
	});

	test('an EMOM shows the round, and leaving mid-workout asks first', async ({ page }) => {
		await page.goto(`/timers/${EMOM_SECTION}?wod=${TODAY_WOD}`);
		await page.getByRole('button', { name: 'Start', exact: true }).click();
		await expect(page.getByText('01/08')).toBeVisible();
		await expect(page.getByRole('timer')).toHaveAccessibleName(/^00 minutes 5\d seconds$/, {
			timeout: 10_000
		});

		await page.getByRole('button', { name: 'Leave the clock' }).click();
		const dialog = page.getByRole('dialog', { name: 'Leave the clock?' });
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Back to the clock' }).click();
		await expect(page.getByText('Paused')).toBeVisible();
	});

	test('a clock link to a section that is gone says so', async ({ page }) => {
		await page.goto(`/timers/${'0'.repeat(32)}?wod=${TODAY_WOD}`);
		await expect(page.getByRole('heading', { name: 'Clock not found' })).toBeVisible();
	});
});
