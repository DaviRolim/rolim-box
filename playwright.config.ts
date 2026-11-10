import { defineConfig } from '@playwright/test';

/**
 * The e2e suite runs the production build against its own SQLite file (e2e.db), seeded fresh
 * on every run, so it never touches local.db and never needs credentials.
 *
 * The build runs under Bun (`bun --bun`) because the Vercel adapter refuses Node versions it
 * does not know, and a developer machine is often ahead of it.
 */
const env = { DATABASE_URL: 'file:e2e.db', DATABASE_AUTH_TOKEN: '', OPENROUTER_API_KEY: '' };

export default defineConfig({
	testDir: 'e2e',
	// One shared database: keep the tests in a predictable order.
	workers: 1,
	fullyParallel: false,
	timeout: 45_000,
	reporter: [['list']],
	use: {
		baseURL: 'http://localhost:4173',
		viewport: { width: 390, height: 844 },
		hasTouch: true,
		isMobile: true,
		trace: 'retain-on-failure'
	},
	webServer: {
		command: 'bun scripts/seed.ts --push && bun --bun run build && bun run preview',
		port: 4173,
		env,
		// Set E2E_REUSE_SERVER=1 to run against a preview server you started yourself with the
		// same environment (handy while writing tests).
		reuseExistingServer: !!process.env.E2E_REUSE_SERVER,
		timeout: 240_000
	}
});
