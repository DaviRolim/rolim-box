import { expect, test } from '@playwright/test';
import { ATHLETE, loginToToday, seedId } from './helpers';

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

	test('a video can be added to an existing PR, edited, and removed', async ({ page }) => {
		const id = seedId('pr:Back Squat:bia');
		const url = 'https://www.youtube.com/shorts/example';
		const replacement = 'https://youtu.be/replacement';
		const savedVideo = async () => {
			const records: { id: string; videoUrl: string | null }[] = await (
				await page.request.get('/api/prs')
			).json();
			return records.find((pr) => pr.id === id)?.videoUrl;
		};
		const exercise = page.getByRole('button', { name: /Back Squat/ });
		const sheet = page.getByRole('dialog', { name: /Back Squat/ });
		const link = sheet.getByRole('link', { name: /Watch the video for the PR/ });
		const field = sheet.getByLabel('Video link', { exact: true });
		const save = sheet.getByRole('button', { name: 'Save', exact: true });

		await exercise.click();
		await sheet.getByRole('button', { name: /Add a video link to the PR/ }).click();
		await field.fill(url);
		await save.click();
		await expect(link).toHaveAttribute('href', url);
		await expect(link).toHaveAttribute('target', '_blank');
		await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
		await expect.poll(savedVideo).toBe(url);

		await page.reload();
		await exercise.click();
		await expect(link).toHaveAttribute('href', url);
		const edit = sheet.getByRole('button', { name: /Edit the video link for the PR/ });
		await edit.click();
		await expect(field).toHaveValue(url);
		await field.fill(replacement);
		await save.click();
		await expect(link).toHaveAttribute('href', replacement);
		await expect.poll(savedVideo).toBe(replacement);

		await edit.click();
		await sheet.getByRole('button', { name: 'Remove video' }).click();
		await expect(link).toHaveCount(0);
		await expect.poll(savedVideo).toBeNull();
	});

	test('a PR logged with a video offline can be edited before syncing', async ({
		page,
		context
	}) => {
		const url = 'https://youtube.com/watch?v=first';
		const replacement = 'https://youtu.be/second';
		await page.getByRole('button', { name: /Back Squat/ }).click();
		const sheet = page.getByRole('dialog', { name: /Back Squat/ });
		await expect(sheet.getByRole('button', { name: /Delete the PR/ })).toBeVisible();
		await context.setOffline(true);

		await sheet.getByLabel('Weight (kg)').fill('86');
		await sheet.getByRole('button', { name: 'Add a video link', exact: true }).click();
		await sheet.getByLabel('Video link', { exact: true }).fill(url);
		await sheet.getByRole('button', { name: 'Save PR' }).click();
		const link = sheet.getByRole('link', { name: /Watch the video for the PR/ });
		await expect(link).toHaveAttribute('href', url);

		await sheet.getByRole('button', { name: /Edit the video link for the PR/ }).click();
		await sheet.getByLabel('Video link', { exact: true }).fill(replacement);
		await sheet.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(link).toHaveAttribute('href', replacement);

		await context.setOffline(false);
		await expect(page.getByRole('link', { name: /sync status: synced/i })).toBeVisible({
			timeout: 15_000
		});
		const records: { id: string; exerciseId: string; value: number; videoUrl: string | null }[] =
			await (await page.request.get('/api/prs')).json();
		const saved = records.filter(
			(pr) => pr.exerciseId === seedId('exercise:Back Squat') && pr.value === 86_000
		);
		expect(saved.map((pr) => pr.videoUrl)).toEqual([replacement]);
		expect((await page.request.delete(`/api/prs/${saved[0].id}`)).ok()).toBe(true);
	});
});
