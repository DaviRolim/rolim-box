import { expect, test, type Page } from '@playwright/test';
import { ATHLETE, COACH, TODAY_WOD, appInstalled, isoDate, loginToToday, seedId } from './helpers';

const WORKSPACE = seedId('workspace:rolimbox');
const IDEA = 'Tide run e2e';
const IDEA_DAY = isoDate(60);
const FULL_DAY = isoDate(61);

type ApiBankWod = {
	id: string;
	name: string;
	description: string | null;
	sections: { name: string }[];
	lastScheduledOn: string | null;
};
type ApiWod = {
	id: string;
	date: string;
	sections: { name: string; timerConfig: string | null }[];
};

async function bankOnServer(page: Page): Promise<ApiBankWod[]> {
	const response = await page.request.get(`/api/bank?workspaceId=${WORKSPACE}`);
	expect(response.ok()).toBe(true);
	return (await response.json()).items;
}

async function wodsOnServer(page: Page, date: string): Promise<ApiWod[]> {
	const response = await page.request.get(`/api/wods?workspaceId=${WORKSPACE}&limit=100`);
	const { wods } = await response.json();
	return wods.filter((w: ApiWod) => w.date === date);
}

test.describe.serial('The WoD bank (coach)', () => {
	test.beforeEach(async ({ page }) => {
		await loginToToday(page, COACH);
	});

	test('save an idea with just a name and a rough description', async ({ page }) => {
		await page.goto('/workouts');
		await page.getByRole('link', { name: /^Bank/ }).click();
		await expect(page).toHaveURL(/\/bank$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Bank' })).toBeVisible();

		await page.getByRole('link', { name: 'New idea' }).click();
		await expect(page.getByRole('heading', { name: 'New idea' })).toBeVisible();
		await page.getByLabel('Name', { exact: true }).fill(IDEA);
		await page.getByLabel("Coach's brief").fill('Low tide: 5k on the sand, burpees every 500m.');
		await page.getByRole('button', { name: 'Save to bank' }).click();

		await expect(page).toHaveURL(/\/bank$/);
		await expect(page.getByRole('status').filter({ hasText: 'Saved to the bank.' })).toBeVisible();
		const row = page.getByRole('listitem').filter({ hasText: IDEA });
		await expect(row).toContainText('Never on the board');

		await expect
			.poll(async () => (await bankOnServer(page)).find((b) => b.name === IDEA))
			.toMatchObject({
				description: 'Low tide: 5k on the sand, burpees every 500m.',
				sections: [],
				lastScheduledOn: null
			});
	});

	test('put the idea on a day: the copy opens to be finished, the bank keeps it', async ({
		page
	}) => {
		await page.goto('/bank');
		await page.getByRole('button', { name: `Put ${IDEA} on a day` }).click();

		const sheet = page.getByRole('dialog', { name: 'Put on a day' });
		await expect(sheet.getByText('It has no sections yet')).toBeVisible();
		await sheet.getByLabel('Day', { exact: true }).fill(IDEA_DAY);
		await sheet.getByRole('button', { name: /^Put on / }).click();

		// A bare idea still needs its sections, so the dated copy opens in the editor.
		await expect(page.getByRole('heading', { name: 'Edit WoD' })).toBeVisible();
		await expect(page.getByLabel('Date')).toHaveValue(IDEA_DAY);
		await expect(page.getByLabel('Name', { exact: true })).toHaveValue(IDEA);

		await expect.poll(async () => (await wodsOnServer(page, IDEA_DAY)).length).toBe(1);
		const [copy] = await wodsOnServer(page, IDEA_DAY);
		expect(copy.sections.map((s) => s.name)).toEqual([IDEA]);

		const kept = (await bankOnServer(page)).find((b) => b.name === IDEA);
		expect(kept?.lastScheduledOn).toBe(IDEA_DAY);

		await page.goto('/bank');
		await expect(page.getByRole('listitem').filter({ hasText: IDEA })).toContainText('Next on');

		await page.request.delete(`/api/wods/${copy.id}`);
	});

	test('a full bank WoD goes on the board as it is', async ({ page }) => {
		await page.goto('/bank');
		await page.getByRole('button', { name: 'Put Filthy Fifty on a day' }).click();
		const sheet = page.getByRole('dialog', { name: 'Put on a day' });
		await sheet.getByLabel('Day', { exact: true }).fill(FULL_DAY);
		await sheet.getByRole('button', { name: /^Put on / }).click();

		await expect(page.getByRole('heading', { level: 1, name: 'Filthy Fifty' })).toBeVisible();
		await expect(page.getByLabel('Format: For time, Cap 35:00')).toBeVisible();

		await expect.poll(async () => (await wodsOnServer(page, FULL_DAY)).length).toBe(1);
		const [copy] = await wodsOnServer(page, FULL_DAY);
		expect(copy.sections.map((s) => s.name)).toEqual(['Warm-up', 'Filthy Fifty', 'Cool-down']);
		expect((await bankOnServer(page)).find((b) => b.name === 'Filthy Fifty')?.lastScheduledOn).toBe(
			FULL_DAY
		);

		await page.request.delete(`/api/wods/${copy.id}`);
	});

	test('save a dated WoD into the bank', async ({ page }) => {
		await page.goto(`/workouts/${TODAY_WOD}`);
		await page.getByRole('button', { name: 'Save to bank' }).click();

		const sheet = page.getByRole('dialog', { name: 'Save to bank' });
		const name = sheet.getByLabel('Name in the bank');
		await expect(name).toHaveValue('Fran');
		await name.fill('Fran e2e');
		await sheet.getByRole('button', { name: 'Save to bank' }).click();
		await expect(
			page.getByRole('status').filter({ hasText: '"Fran e2e" is in the bank.' })
		).toBeVisible();

		await page.goto('/bank');
		await expect(page.getByRole('listitem').filter({ hasText: 'Fran e2e' })).toContainText(
			'On the board today'
		);

		const today = await (await page.request.get(`/api/wods/${TODAY_WOD}`)).json();
		await expect
			.poll(async () => (await bankOnServer(page)).find((b) => b.name === 'Fran e2e'))
			.toMatchObject({ lastScheduledOn: isoDate() });
		const saved = (await bankOnServer(page)).find((b) => b.name === 'Fran e2e')!;
		expect(saved.sections.map((s) => s.name)).toEqual(
			today.sections.map((s: { name: string }) => s.name)
		);
		expect(saved.description).toBe(today.description);
	});

	test('tidy up: delete from the bank', async ({ page }) => {
		await page.goto('/bank');
		for (const name of [IDEA, 'Fran e2e']) {
			await page.getByRole('button', { name: `Actions for ${name}` }).click();
			await page.getByRole('button', { name: 'Delete', exact: true }).click();
			await page
				.getByRole('dialog', { name: 'Delete from the bank?' })
				.getByRole('button', {
					name: 'Delete',
					exact: true
				})
				.click();
			await expect(page.getByRole('listitem').filter({ hasText: name })).toHaveCount(0);
		}
		await expect
			.poll(async () => (await bankOnServer(page)).map((b) => b.name))
			.not.toContain(IDEA);
	});
});

test('an idea written offline is kept and sent when the connection returns', async ({
	page,
	context
}) => {
	await loginToToday(page, COACH);
	await appInstalled(page);
	await page.goto('/bank/new');
	await expect(page.getByRole('heading', { name: 'New idea' })).toBeVisible();
	await page.waitForLoadState('networkidle');
	await context.setOffline(true);

	await page.getByLabel('Name', { exact: true }).fill('Offline idea e2e');
	await page.getByLabel("Coach's brief").fill('Written on the beach with no signal.');
	await page.getByRole('button', { name: 'Save to bank' }).click();

	await expect(page).toHaveURL(/\/bank$/);
	await expect(page.getByRole('listitem').filter({ hasText: 'Offline idea e2e' })).toBeVisible();
	await expect(page.getByRole('link', { name: /sync status: offline/i })).toBeVisible();

	await context.setOffline(false);
	await expect(page.getByRole('link', { name: /sync status: synced/i })).toBeVisible({
		timeout: 15_000
	});
	const saved = (await bankOnServer(page)).find((b) => b.name === 'Offline idea e2e');
	expect(saved?.description).toBe('Written on the beach with no signal.');

	await page.request.delete(`/api/bank/${saved!.id}`);
});

test('athletes do not see the bank', async ({ page }) => {
	await loginToToday(page, ATHLETE);

	await page.goto('/workouts');
	await expect(page.getByRole('link', { name: /^Fran/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /^Bank/ })).toHaveCount(0);
	await expect(page.getByRole('link', { name: /from the bank/i })).toHaveCount(0);

	await page.goto(`/workouts/${TODAY_WOD}`);
	await expect(page.getByRole('heading', { level: 1, name: 'Fran' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Save to bank' })).toHaveCount(0);

	await page.goto('/bank');
	await expect(page.getByRole('heading', { name: 'Not your whiteboard' })).toBeVisible();
	await expect(page.getByText('Filthy Fifty')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'New idea' })).toHaveCount(0);

	await page.goto(`/bank/${seedId('bank:filthy')}`);
	await expect(page.getByRole('heading', { name: 'Not your whiteboard' })).toBeVisible();

	// The API refuses too, reading included.
	expect((await page.request.get(`/api/bank?workspaceId=${WORKSPACE}`)).status()).toBe(403);
	expect((await page.request.get(`/api/bank/${seedId('bank:filthy')}`)).status()).toBe(403);
	const create = await page.request.post('/api/bank', {
		data: { workspaceId: WORKSPACE, name: 'Sneaky', description: null, sections: [] }
	});
	expect(create.status()).toBe(403);
});
