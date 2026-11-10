import { expect, test, type Page } from '@playwright/test';
import { COACH, loginToToday } from './helpers';

const toggle = (page: Page, label: 'EN' | 'PT') =>
	page.getByRole('button', { name: label, exact: true });

test.describe('Language', () => {
	test.describe('a phone set to Portuguese', () => {
		test.use({ locale: 'pt-BR' });

		test('still opens in English: the app never guesses from the browser', async ({ page }) => {
			await page.goto('/login');
			await expect(page.locator('html')).toHaveAttribute('lang', 'en');
			await expect(toggle(page, 'EN')).toHaveAttribute('aria-pressed', 'true');
			await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
		});
	});

	test('the front door switches to Portuguese and remembers it', async ({ page }) => {
		await page.goto('/login');
		await toggle(page, 'PT').click();

		await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
		await expect(toggle(page, 'PT')).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByLabel('Senha', { exact: true })).toBeVisible();

		// The server renders the next page in Portuguese straight away (no English flash).
		const html = await (await page.request.get('/login')).text();
		expect(html).toContain('<html lang="pt-BR">');
		expect(html).toContain('Senha');

		await page.reload();
		await expect(toggle(page, 'PT')).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByLabel('Senha', { exact: true })).toBeVisible();

		// And logging in from there works the same.
		await page.locator('input[name="email"]').fill(COACH);
		await page.getByLabel('Senha', { exact: true }).fill('not-the-password');
		await page.locator('form button[type="submit"]').first().click();
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(page.getByRole('alert')).not.toContainText('Invalid email or password');
	});

	test('the app switches live, survives a reload, and switches back', async ({ page }) => {
		await loginToToday(page, COACH);
		const nav = page.getByRole('navigation', { name: 'Main' });
		await expect(nav.getByRole('link', { name: 'Today' })).toBeVisible();

		await toggle(page, 'PT').click();
		const navPt = page.getByRole('navigation', { name: 'Principal' });
		await expect(navPt.getByRole('link', { name: 'Hoje' })).toBeVisible();
		await expect(navPt.getByRole('link', { name: 'Relógio' })).toBeVisible();
		// The board's own date follows the language too (Intl, pt-BR).
		const weekday = new Date()
			.toLocaleDateString('pt-BR', { weekday: 'short' })
			.replace('.', '')
			.toUpperCase();
		await expect(page.getByRole('main')).toContainText(new RegExp(weekday, 'i'));
		// Painted brand phrases stay Portuguese in both languages.
		await expect(page.getByText('Vai doer').first()).toBeVisible();

		await page.reload();
		await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
		await expect(navPt.getByRole('link', { name: 'Hoje' })).toBeVisible();

		await page.goto('/settings');
		await expect(toggle(page, 'PT')).toHaveAttribute('aria-pressed', 'true');
		await toggle(page, 'EN').click();
		await expect(nav.getByRole('link', { name: 'Today' })).toBeVisible();
		await page.reload();
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		await expect(nav.getByRole('link', { name: 'Today' })).toBeVisible();
	});
});
