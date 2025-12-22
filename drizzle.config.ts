import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const isLocalDb = process.env.DATABASE_URL.startsWith('file:');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: isLocalDb ? 'sqlite' : 'turso',

	dbCredentials: isLocalDb
		? { url: process.env.DATABASE_URL }
		: {
				authToken: process.env.DATABASE_AUTH_TOKEN,
				url: process.env.DATABASE_URL
			},

	verbose: true,
	strict: true
});
