import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// A local SQLite file (DATABASE_URL="file:local.db") needs no token, in dev, preview or tests.
// Anything remote (Turso) must always have one.
const isLocalFile = env.DATABASE_URL.startsWith('file:');
if (!isLocalFile && !env.DATABASE_AUTH_TOKEN) throw new Error('DATABASE_AUTH_TOKEN is not set');

const client = createClient({
	url: env.DATABASE_URL,
	authToken: isLocalFile ? undefined : env.DATABASE_AUTH_TOKEN
});

export const db = drizzle(client, { schema });
