import { expect, test } from '@playwright/test';
import { ATHLETE, COACH, login, loginToToday } from './helpers';

test.describe('Getting in', () => {
	test('the front door sends strangers to the login page', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\/login$/);
		await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
	});

	test('a wrong password is explained and the email is kept', async ({ page }) => {
		await login(page, COACH, 'not-the-password');
		await expect(page.getByRole('alert')).toContainText('Invalid email or password');
		await expect(page.getByLabel('Email')).toHaveValue(COACH);
	});

	test('a coach lands on today and can edit', async ({ page }) => {
		await loginToToday(page, COACH);
		await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
	});

	test('an athlete lands on today and cannot edit', async ({ page }) => {
		await loginToToday(page, ATHLETE);
		await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);

		await page.goto('/workouts/new');
		await expect(page.getByRole('heading', { name: 'Not your whiteboard' })).toBeVisible();
	});

	test('an expired invite says so, a valid one offers to join', async ({ page }) => {
		await page.goto('/join/EXP-222');
		await expect(page.getByRole('heading', { name: 'Too late' })).toBeVisible();

		await page.goto('/join/RLM-B2X');
		await expect(page.getByRole('heading', { name: 'RolimBox' })).toBeVisible();
		await expect(page.getByRole('button', { name: /create account & join/i })).toBeVisible();
	});

	test('logging out returns to the login page', async ({ page }) => {
		await loginToToday(page, ATHLETE);
		await page.goto('/settings');
		await page.getByRole('button', { name: 'Log out' }).click();
		await expect(page).toHaveURL(/\/login$/);
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login$/);
	});
});
