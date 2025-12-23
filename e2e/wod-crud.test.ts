import { expect, test } from '@playwright/test';

test.describe('WoD CRUD', () => {
	test.beforeEach(async ({ page }) => {
		// TODO: Add auth setup if needed
		// For now, assume test user is logged in
	});

	test('can create a new WoD with sections', async ({ page }) => {
		// Navigate to new WoD page
		await page.goto('/workouts/new');

		// Fill in date (should default to today)
		const dateInput = page.locator('input[type="date"]');
		await expect(dateInput).toBeVisible();

		// Fill in description
		await page.fill('textarea#workout-description', 'Test workout description');

		// Add a section
		await page.click('text=Add Section');

		// Fill section details
		await page.fill('input#section-name', 'Test Warmup');
		await page.fill('textarea#section-content', '400m run\n20 air squats');

		// Save section
		await page.click('button:has-text("Add Section")');

		// Save WoD
		await page.click('text=Save Workout');

		// Verify redirect to WoD list
		await expect(page).toHaveURL(/\/workouts$/);

		// Verify content is displayed (this may require navigating to the specific workout)
		// Note: The current implementation redirects to /workouts list, not the detail view
		// So we check for success indication instead
		await expect(page.locator('text=Test workout description').or(page.locator('text=Workout created'))).toBeVisible({ timeout: 10000 });
	});
});
