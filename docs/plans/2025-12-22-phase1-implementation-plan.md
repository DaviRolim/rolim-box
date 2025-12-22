# Phase 1: Core Infrastructure - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the foundational PWA shell with authentication, database schema, and offline-capable data sync for RolimBox.

**Architecture:** SvelteKit app with Turso (SQLite) for persistence, IndexedDB for local caching, email/password auth with Argon2 hashing. Workspace model enables future multi-user support. Read-only offline mode with online sync.

**Tech Stack:** SvelteKit, Svelte 5 runes, Drizzle ORM, Turso, IndexedDB (idb library), Argon2 (@node-rs/argon2), Tailwind CSS v4

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install password hashing and IndexedDB libraries**

Run:
```bash
bun add @node-rs/argon2 idb
```

**Step 2: Verify installation**

Run:
```bash
bun run check
```
Expected: No errors

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add argon2 and idb dependencies"
```

---

## Task 2: Update Database Schema

**Files:**
- Modify: `src/lib/server/db/schema.ts`

**Step 1: Replace schema with full Phase 1 schema**

Replace entire contents of `src/lib/server/db/schema.ts`:

```typescript
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// User account
export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

// Session
export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

// Workspace (for future multi-user support)
export const workspace = sqliteTable('workspace', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

// User-Workspace membership
export const workspaceMember = sqliteTable(
	'workspace_member',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		workspaceId: text('workspace_id')
			.notNull()
			.references(() => workspace.id),
		role: text('role').notNull(), // 'owner' | 'coach'
		joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.userId, table.workspaceId] })]
);

// Workout of the Day
export const wod = sqliteTable('wod', {
	id: text('id').primaryKey(),
	workspaceId: text('workspace_id')
		.notNull()
		.references(() => workspace.id),
	date: text('date').notNull(), // ISO date: "2025-12-22"
	description: text('description'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

// WoD Sections
export const section = sqliteTable('section', {
	id: text('id').primaryKey(),
	wodId: text('wod_id')
		.notNull()
		.references(() => wod.id, { onDelete: 'cascade' }),
	type: text('type').notNull(), // 'warmup'|'skill'|'wod'|'cooldown'|'stretches'|'custom'
	name: text('name').notNull(),
	content: text('content').notNull().default(''),
	order: integer('order').notNull(),
	timerConfig: text('timer_config') // nullable, JSON string
});

// Type exports
export type Session = typeof session.$inferSelect;
export type User = typeof user.$inferSelect;
export type Workspace = typeof workspace.$inferSelect;
export type WorkspaceMember = typeof workspaceMember.$inferSelect;
export type Wod = typeof wod.$inferSelect;
export type Section = typeof section.$inferSelect;
```

**Step 2: Verify schema compiles**

Run:
```bash
bun run check
```
Expected: No errors

**Step 3: Generate and push migration**

Run:
```bash
bun run db:push
```
Expected: Tables created/updated in Turso

**Step 4: Commit**

```bash
git add src/lib/server/db/schema.ts
git commit -m "feat: add workspace, wod, and section tables to schema"
```

---

## Task 3: Update Auth Service for Email/Password

**Files:**
- Modify: `src/lib/server/auth.ts`

**Step 1: Update auth.ts with password hashing and user creation**

Replace entire contents of `src/lib/server/auth.ts`:

```typescript
import type { RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import { hash, verify } from '@node-rs/argon2';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const sessionCookieName = 'auth-session';

export function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(18));
	return encodeBase64url(bytes);
}

export function generateId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return encodeHexLowerCase(bytes);
}

export async function hashPassword(password: string): Promise<string> {
	return hash(password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	});
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
	return verify(hash, password);
}

export async function createUser(email: string, password: string): Promise<table.User> {
	const id = generateId();
	const passwordHash = await hashPassword(password);
	const now = new Date();

	const [newUser] = await db
		.insert(table.user)
		.values({
			id,
			email: email.toLowerCase(),
			passwordHash,
			createdAt: now
		})
		.returning();

	return newUser;
}

export async function createWorkspaceForUser(
	userId: string,
	workspaceName: string = 'My Workspace'
): Promise<table.Workspace> {
	const workspaceId = generateId();
	const now = new Date();

	const [newWorkspace] = await db
		.insert(table.workspace)
		.values({
			id: workspaceId,
			name: workspaceName,
			createdAt: now
		})
		.returning();

	await db.insert(table.workspaceMember).values({
		userId,
		workspaceId,
		role: 'owner',
		joinedAt: now
	});

	return newWorkspace;
}

export async function findUserByEmail(email: string): Promise<table.User | undefined> {
	const [user] = await db
		.select()
		.from(table.user)
		.where(eq(table.user.email, email.toLowerCase()));
	return user;
}

export async function getUserWorkspace(userId: string): Promise<table.Workspace | undefined> {
	const result = await db
		.select({ workspace: table.workspace })
		.from(table.workspaceMember)
		.innerJoin(table.workspace, eq(table.workspaceMember.workspaceId, table.workspace.id))
		.where(eq(table.workspaceMember.userId, userId))
		.limit(1);

	return result[0]?.workspace;
}

export async function createSession(token: string, userId: string): Promise<table.Session> {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
	const session: table.Session = {
		id: sessionId,
		userId,
		expiresAt: new Date(Date.now() + DAY_IN_MS * 30)
	};
	await db.insert(table.session).values(session);
	return session;
}

export async function validateSessionToken(
	token: string
): Promise<{ session: table.Session | null; user: Omit<table.User, 'passwordHash'> | null }> {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
	const [result] = await db
		.select({
			user: {
				id: table.user.id,
				email: table.user.email,
				createdAt: table.user.createdAt
			},
			session: table.session
		})
		.from(table.session)
		.innerJoin(table.user, eq(table.session.userId, table.user.id))
		.where(eq(table.session.id, sessionId));

	if (!result) {
		return { session: null, user: null };
	}

	const { session, user } = result;

	const sessionExpired = Date.now() >= session.expiresAt.getTime();
	if (sessionExpired) {
		await db.delete(table.session).where(eq(table.session.id, session.id));
		return { session: null, user: null };
	}

	const renewSession = Date.now() >= session.expiresAt.getTime() - DAY_IN_MS * 15;
	if (renewSession) {
		session.expiresAt = new Date(Date.now() + DAY_IN_MS * 30);
		await db
			.update(table.session)
			.set({ expiresAt: session.expiresAt })
			.where(eq(table.session.id, session.id));
	}

	return { session, user };
}

export type SessionValidationResult = Awaited<ReturnType<typeof validateSessionToken>>;

export async function invalidateSession(sessionId: string): Promise<void> {
	await db.delete(table.session).where(eq(table.session.id, sessionId));
}

export function setSessionTokenCookie(event: RequestEvent, token: string, expiresAt: Date): void {
	event.cookies.set(sessionCookieName, token, {
		expires: expiresAt,
		path: '/'
	});
}

export function deleteSessionTokenCookie(event: RequestEvent): void {
	event.cookies.delete(sessionCookieName, {
		path: '/'
	});
}
```

**Step 2: Verify auth compiles**

Run:
```bash
bun run check
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/server/auth.ts
git commit -m "feat: add email/password auth with argon2 and workspace creation"
```

---

## Task 4: Update App Types

**Files:**
- Modify: `src/app.d.ts`

**Step 1: Update App.Locals type definition**

Replace entire contents of `src/app.d.ts`:

```typescript
// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			user: import('$lib/server/auth').SessionValidationResult['user'];
			session: import('$lib/server/auth').SessionValidationResult['session'];
		}
	}
}

export {};
```

**Step 2: Verify types**

Run:
```bash
bun run check
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/app.d.ts
git commit -m "chore: clean up app.d.ts type definitions"
```

---

## Task 5: Create Registration Page

**Files:**
- Create: `src/routes/(auth)/register/+page.svelte`
- Create: `src/routes/(auth)/register/+page.server.ts`

**Step 1: Create register directory**

Run:
```bash
mkdir -p src/routes/\(auth\)/register
```

**Step 2: Create registration server action**

Create `src/routes/(auth)/register/+page.server.ts`:

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as auth from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email');
		const password = formData.get('password');

		if (typeof email !== 'string' || !email.includes('@')) {
			return fail(400, { error: 'Invalid email address' });
		}

		if (typeof password !== 'string' || password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters' });
		}

		const existingUser = await auth.findUserByEmail(email);
		if (existingUser) {
			return fail(400, { error: 'Email already registered' });
		}

		const user = await auth.createUser(email, password);
		await auth.createWorkspaceForUser(user.id);

		const token = auth.generateSessionToken();
		const session = await auth.createSession(token, user.id);

		cookies.set(auth.sessionCookieName, token, {
			expires: session.expiresAt,
			path: '/'
		});

		throw redirect(302, '/');
	}
};
```

**Step 3: Create registration page UI**

Create `src/routes/(auth)/register/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Register - RolimBox</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-secondary-900 p-4">
	<div class="w-full max-w-md">
		<h1 class="mb-8 text-center text-3xl font-bold text-white">Create Account</h1>

		<form method="POST" use:enhance class="space-y-4">
			{#if form?.error}
				<div class="rounded bg-red-900/50 p-3 text-red-200">
					{form.error}
				</div>
			{/if}

			<div>
				<label for="email" class="mb-1 block text-sm text-gray-300">Email</label>
				<input
					type="email"
					id="email"
					name="email"
					required
					class="w-full rounded border border-gray-700 bg-secondary-800 px-4 py-2 text-white focus:border-accent-500 focus:outline-none"
				/>
			</div>

			<div>
				<label for="password" class="mb-1 block text-sm text-gray-300">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					minlength="8"
					class="w-full rounded border border-gray-700 bg-secondary-800 px-4 py-2 text-white focus:border-accent-500 focus:outline-none"
				/>
				<p class="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
			</div>

			<button
				type="submit"
				class="w-full rounded bg-accent-500 px-4 py-2 font-semibold text-white transition hover:bg-accent-400"
			>
				Register
			</button>
		</form>

		<p class="mt-4 text-center text-gray-400">
			Already have an account?
			<a href="/login" class="text-accent-400 hover:underline">Log in</a>
		</p>
	</div>
</div>
```

**Step 4: Verify page compiles**

Run:
```bash
bun run check
```
Expected: No errors

**Step 5: Commit**

```bash
git add src/routes/\(auth\)/register/
git commit -m "feat: add registration page with email/password"
```

---

## Task 6: Create Login Page

**Files:**
- Create: `src/routes/(auth)/login/+page.svelte`
- Create: `src/routes/(auth)/login/+page.server.ts`

**Step 1: Create login directory**

Run:
```bash
mkdir -p src/routes/\(auth\)/login
```

**Step 2: Create login server action**

Create `src/routes/(auth)/login/+page.server.ts`:

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as auth from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email');
		const password = formData.get('password');

		if (typeof email !== 'string' || !email.includes('@')) {
			return fail(400, { error: 'Invalid email address' });
		}

		if (typeof password !== 'string' || password.length < 1) {
			return fail(400, { error: 'Password is required' });
		}

		const user = await auth.findUserByEmail(email);
		if (!user) {
			return fail(400, { error: 'Invalid email or password' });
		}

		const validPassword = await auth.verifyPassword(user.passwordHash, password);
		if (!validPassword) {
			return fail(400, { error: 'Invalid email or password' });
		}

		const token = auth.generateSessionToken();
		const session = await auth.createSession(token, user.id);

		cookies.set(auth.sessionCookieName, token, {
			expires: session.expiresAt,
			path: '/'
		});

		throw redirect(302, '/');
	}
};
```

**Step 3: Create login page UI**

Create `src/routes/(auth)/login/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Login - RolimBox</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-secondary-900 p-4">
	<div class="w-full max-w-md">
		<h1 class="mb-8 text-center text-3xl font-bold text-white">Welcome Back</h1>

		<form method="POST" use:enhance class="space-y-4">
			{#if form?.error}
				<div class="rounded bg-red-900/50 p-3 text-red-200">
					{form.error}
				</div>
			{/if}

			<div>
				<label for="email" class="mb-1 block text-sm text-gray-300">Email</label>
				<input
					type="email"
					id="email"
					name="email"
					required
					class="w-full rounded border border-gray-700 bg-secondary-800 px-4 py-2 text-white focus:border-accent-500 focus:outline-none"
				/>
			</div>

			<div>
				<label for="password" class="mb-1 block text-sm text-gray-300">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					class="w-full rounded border border-gray-700 bg-secondary-800 px-4 py-2 text-white focus:border-accent-500 focus:outline-none"
				/>
			</div>

			<button
				type="submit"
				class="w-full rounded bg-accent-500 px-4 py-2 font-semibold text-white transition hover:bg-accent-400"
			>
				Log In
			</button>
		</form>

		<p class="mt-4 text-center text-gray-400">
			Don't have an account?
			<a href="/register" class="text-accent-400 hover:underline">Register</a>
		</p>
	</div>
</div>
```

**Step 4: Verify page compiles**

Run:
```bash
bun run check
```
Expected: No errors

**Step 5: Commit**

```bash
git add src/routes/\(auth\)/login/
git commit -m "feat: add login page with email/password"
```

---

## Task 7: Create Auth Layout (Redirect if Logged In)

**Files:**
- Create: `src/routes/(auth)/+layout.server.ts`

**Step 1: Create auth layout server load**

Create `src/routes/(auth)/+layout.server.ts`:

```typescript
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
};
```

**Step 2: Verify compiles**

Run:
```bash
bun run check
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/routes/\(auth\)/+layout.server.ts
git commit -m "feat: add auth layout to redirect logged-in users"
```

---

## Task 8: Create Protected App Layout

**Files:**
- Create: `src/routes/(app)/+layout.svelte`
- Create: `src/routes/(app)/+layout.server.ts`

**Step 1: Create app directory**

Run:
```bash
mkdir -p src/routes/\(app\)
```

**Step 2: Create protected layout server load**

Create `src/routes/(app)/+layout.server.ts`:

```typescript
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import * as auth from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const workspace = await auth.getUserWorkspace(locals.user.id);

	return {
		user: locals.user,
		workspace
	};
};
```

**Step 3: Create app layout component**

Create `src/routes/(app)/+layout.svelte`:

```svelte
<script lang="ts">
	let { data, children } = $props();
</script>

<div class="min-h-screen bg-secondary-900">
	<header class="border-b border-gray-800 bg-secondary-800 px-4 py-3">
		<div class="mx-auto flex max-w-4xl items-center justify-between">
			<h1 class="text-xl font-bold text-white">RolimBox</h1>
			<div class="flex items-center gap-4">
				<span class="text-sm text-gray-400">{data.user?.email}</span>
				<form action="/logout" method="POST">
					<button
						type="submit"
						class="text-sm text-gray-400 transition hover:text-white"
					>
						Logout
					</button>
				</form>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-4xl p-4">
		{@render children()}
	</main>
</div>
```

**Step 4: Verify compiles**

Run:
```bash
bun run check
```
Expected: No errors

**Step 5: Commit**

```bash
git add src/routes/\(app\)/
git commit -m "feat: add protected app layout with header and logout"
```

---

## Task 9: Create Dashboard Page

**Files:**
- Create: `src/routes/(app)/+page.svelte`

**Step 1: Create dashboard page**

Create `src/routes/(app)/+page.svelte`:

```svelte
<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Dashboard - RolimBox</title>
</svelte:head>

<div class="space-y-6">
	<h2 class="text-2xl font-bold text-white">Dashboard</h2>

	<div class="rounded-lg border border-gray-800 bg-secondary-800 p-6">
		<h3 class="mb-2 text-lg font-semibold text-white">Welcome to RolimBox</h3>
		<p class="text-gray-400">
			Your CrossFit workout management system. WoD creation and timer features coming soon.
		</p>
	</div>

	{#if data.workspace}
		<div class="rounded-lg border border-gray-800 bg-secondary-800 p-6">
			<h3 class="mb-2 text-sm font-medium text-gray-400">Current Workspace</h3>
			<p class="text-white">{data.workspace.name}</p>
		</div>
	{/if}
</div>
```

**Step 2: Verify compiles**

Run:
```bash
bun run check
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/routes/\(app\)/+page.svelte
git commit -m "feat: add dashboard page placeholder"
```

---

## Task 10: Create Logout Action

**Files:**
- Create: `src/routes/logout/+page.server.ts`

**Step 1: Create logout directory**

Run:
```bash
mkdir -p src/routes/logout
```

**Step 2: Create logout server action**

Create `src/routes/logout/+page.server.ts`:

```typescript
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as auth from '$lib/server/auth';

export const load: PageServerLoad = async () => {
	throw redirect(302, '/');
};

export const actions: Actions = {
	default: async ({ locals, cookies }) => {
		if (locals.session) {
			await auth.invalidateSession(locals.session.id);
		}
		auth.deleteSessionTokenCookie({ cookies } as any);
		throw redirect(302, '/login');
	}
};
```

**Step 3: Verify compiles**

Run:
```bash
bun run check
```
Expected: No errors

**Step 4: Commit**

```bash
git add src/routes/logout/
git commit -m "feat: add logout action"
```

---

## Task 11: Update Root Page to Redirect

**Files:**
- Modify: `src/routes/+page.svelte`
- Create: `src/routes/+page.server.ts`

**Step 1: Create root page server load for redirect**

Create `src/routes/+page.server.ts`:

```typescript
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		// Redirect to app dashboard (which is in the (app) group)
		throw redirect(302, '/dashboard');
	} else {
		throw redirect(302, '/login');
	}
};
```

**Step 2: Simplify root page (will rarely be seen)**

Replace entire contents of `src/routes/+page.svelte`:

```svelte
<p>Redirecting...</p>
```

**Step 3: Rename dashboard route**

Since we want `/` to redirect and dashboard to be at `/dashboard`, let's move the app page:

Run:
```bash
mkdir -p src/routes/\(app\)/dashboard
mv src/routes/\(app\)/+page.svelte src/routes/\(app\)/dashboard/+page.svelte
```

**Step 4: Verify compiles**

Run:
```bash
bun run check
```
Expected: No errors

**Step 5: Commit**

```bash
git add src/routes/+page.svelte src/routes/+page.server.ts src/routes/\(app\)/dashboard/
git commit -m "feat: add root redirect and move dashboard to /dashboard"
```

---

## Task 12: Add Tailwind Brand Colors

**Files:**
- Modify: `src/routes/layout.css`

**Step 1: Add brand color tokens to Tailwind config**

Replace entire contents of `src/routes/layout.css`:

```css
@import 'tailwindcss';
@plugin '@tailwindcss/forms';
@plugin '@tailwindcss/typography';

@theme {
	/* Primary - Dark Purple */
	--color-primary-900: #2D1B4E;
	--color-primary-800: #3D2663;
	--color-primary-700: #4A2C6F;
	--color-primary-600: #5C3A87;
	--color-primary-500: #6E489F;

	/* Secondary - Black */
	--color-secondary-900: #0A0A0A;
	--color-secondary-800: #1A1A1A;
	--color-secondary-700: #2A2A2A;

	/* Accent - Pink */
	--color-accent-500: #E91E8C;
	--color-accent-400: #FF6B9D;
	--color-accent-300: #FF8FB3;

	/* Muted - Light Purple */
	--color-muted: #8B7AB8;
}
```

**Step 2: Verify compiles**

Run:
```bash
bun run check
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/routes/layout.css
git commit -m "feat: add RolimBox brand colors to Tailwind theme"
```

---

## Task 13: Add PWA Manifest

**Files:**
- Create: `static/manifest.json`

**Step 1: Create PWA manifest**

Create `static/manifest.json`:

```json
{
	"name": "RolimBox",
	"short_name": "RolimBox",
	"description": "CrossFit Workout Management & Timer System",
	"start_url": "/",
	"display": "standalone",
	"background_color": "#0A0A0A",
	"theme_color": "#2D1B4E",
	"icons": [
		{
			"src": "/icons/icon-192.png",
			"sizes": "192x192",
			"type": "image/png"
		},
		{
			"src": "/icons/icon-512.png",
			"sizes": "512x512",
			"type": "image/png"
		}
	]
}
```

**Step 2: Commit**

```bash
git add static/manifest.json
git commit -m "feat: add PWA manifest"
```

---

## Task 14: Add PWA Icons (Placeholder)

**Files:**
- Create: `static/icons/icon-192.png`
- Create: `static/icons/icon-512.png`

**Step 1: Create icons directory**

Run:
```bash
mkdir -p static/icons
```

**Step 2: Create placeholder icons using ImageMagick (or skip if not available)**

Run:
```bash
# Create simple placeholder icons - purple squares with "RB" text
# If ImageMagick not available, create manually or use any 192x192 and 512x512 PNG

# Check if convert (ImageMagick) is available
if command -v convert &> /dev/null; then
  convert -size 192x192 xc:'#2D1B4E' -gravity center -pointsize 72 -fill white -annotate 0 'RB' static/icons/icon-192.png
  convert -size 512x512 xc:'#2D1B4E' -gravity center -pointsize 192 -fill white -annotate 0 'RB' static/icons/icon-512.png
else
  echo "ImageMagick not found. Please create icons manually."
fi
```

If ImageMagick is not available, create placeholder icons manually (any 192x192 and 512x512 PNG files).

**Step 3: Commit**

```bash
git add static/icons/
git commit -m "feat: add PWA placeholder icons"
```

---

## Task 15: Add Service Worker

**Files:**
- Create: `static/sw.js`

**Step 1: Create service worker**

Create `static/sw.js`:

```javascript
const CACHE_NAME = 'rolimbox-v1';
const STATIC_ASSETS = [
	'/',
	'/manifest.json',
	'/icons/icon-192.png',
	'/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames
					.filter((name) => name !== CACHE_NAME)
					.map((name) => caches.delete(name))
			);
		})
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	// Skip non-GET requests
	if (event.request.method !== 'GET') return;

	// Network-first for API and dynamic routes
	if (event.request.url.includes('/api/') ||
	    event.request.url.includes('/login') ||
	    event.request.url.includes('/register') ||
	    event.request.url.includes('/logout')) {
		event.respondWith(
			fetch(event.request).catch(() => caches.match(event.request))
		);
		return;
	}

	// Cache-first for static assets
	event.respondWith(
		caches.match(event.request).then((cached) => {
			return cached || fetch(event.request).then((response) => {
				// Cache successful responses
				if (response.status === 200) {
					const responseClone = response.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseClone);
					});
				}
				return response;
			});
		})
	);
});
```

**Step 2: Commit**

```bash
git add static/sw.js
git commit -m "feat: add service worker for offline caching"
```

---

## Task 16: Update Root Layout with PWA Meta Tags

**Files:**
- Modify: `src/routes/+layout.svelte`

**Step 1: Add PWA meta tags and service worker registration**

Replace entire contents of `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { browser } from '$app/environment';

	let { children } = $props();

	// Register service worker
	if (browser && 'serviceWorker' in navigator) {
		navigator.serviceWorker.register('/sw.js');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#2D1B4E" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<link rel="apple-touch-icon" href="/icons/icon-192.png" />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

{@render children()}
```

**Step 2: Verify compiles**

Run:
```bash
bun run check
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: add PWA meta tags and service worker registration"
```

---

## Task 17: Create IndexedDB Cache Layer

**Files:**
- Create: `src/lib/db/indexeddb.ts`

**Step 1: Create db directory**

Run:
```bash
mkdir -p src/lib/db
```

**Step 2: Create IndexedDB wrapper**

Create `src/lib/db/indexeddb.ts`:

```typescript
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { browser } from '$app/environment';

interface RolimBoxDB extends DBSchema {
	wods: {
		key: string;
		value: {
			id: string;
			workspaceId: string;
			date: string;
			description: string | null;
			createdAt: number;
			updatedAt: number;
		};
		indexes: {
			'by-workspace': string;
			'by-date': string;
		};
	};
	sections: {
		key: string;
		value: {
			id: string;
			wodId: string;
			type: string;
			name: string;
			content: string;
			order: number;
			timerConfig: string | null;
		};
		indexes: {
			'by-wod': string;
		};
	};
	syncMeta: {
		key: string;
		value: {
			key: string;
			timestamp: number;
		};
	};
}

const DB_NAME = 'rolimbox';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RolimBoxDB>> | null = null;

function getDB(): Promise<IDBPDatabase<RolimBoxDB>> {
	if (!browser) {
		throw new Error('IndexedDB is only available in the browser');
	}

	if (!dbPromise) {
		dbPromise = openDB<RolimBoxDB>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				// WoDs store
				if (!db.objectStoreNames.contains('wods')) {
					const wodStore = db.createObjectStore('wods', { keyPath: 'id' });
					wodStore.createIndex('by-workspace', 'workspaceId');
					wodStore.createIndex('by-date', 'date');
				}

				// Sections store
				if (!db.objectStoreNames.contains('sections')) {
					const sectionStore = db.createObjectStore('sections', { keyPath: 'id' });
					sectionStore.createIndex('by-wod', 'wodId');
				}

				// Sync metadata store
				if (!db.objectStoreNames.contains('syncMeta')) {
					db.createObjectStore('syncMeta', { keyPath: 'key' });
				}
			}
		});
	}

	return dbPromise;
}

// WoD operations
export async function cacheWod(wod: RolimBoxDB['wods']['value']): Promise<void> {
	const db = await getDB();
	await db.put('wods', wod);
}

export async function cacheWods(wods: RolimBoxDB['wods']['value'][]): Promise<void> {
	const db = await getDB();
	const tx = db.transaction('wods', 'readwrite');
	await Promise.all([...wods.map((wod) => tx.store.put(wod)), tx.done]);
}

export async function getCachedWod(id: string): Promise<RolimBoxDB['wods']['value'] | undefined> {
	const db = await getDB();
	return db.get('wods', id);
}

export async function getCachedWodsByWorkspace(
	workspaceId: string
): Promise<RolimBoxDB['wods']['value'][]> {
	const db = await getDB();
	return db.getAllFromIndex('wods', 'by-workspace', workspaceId);
}

export async function deleteCachedWod(id: string): Promise<void> {
	const db = await getDB();
	await db.delete('wods', id);
}

export async function clearCachedWods(): Promise<void> {
	const db = await getDB();
	await db.clear('wods');
}

// Section operations
export async function cacheSection(section: RolimBoxDB['sections']['value']): Promise<void> {
	const db = await getDB();
	await db.put('sections', section);
}

export async function cacheSections(sections: RolimBoxDB['sections']['value'][]): Promise<void> {
	const db = await getDB();
	const tx = db.transaction('sections', 'readwrite');
	await Promise.all([...sections.map((section) => tx.store.put(section)), tx.done]);
}

export async function getCachedSectionsByWod(
	wodId: string
): Promise<RolimBoxDB['sections']['value'][]> {
	const db = await getDB();
	return db.getAllFromIndex('sections', 'by-wod', wodId);
}

export async function deleteCachedSectionsByWod(wodId: string): Promise<void> {
	const db = await getDB();
	const sections = await db.getAllFromIndex('sections', 'by-wod', wodId);
	const tx = db.transaction('sections', 'readwrite');
	await Promise.all([...sections.map((s) => tx.store.delete(s.id)), tx.done]);
}

export async function clearCachedSections(): Promise<void> {
	const db = await getDB();
	await db.clear('sections');
}

// Sync metadata
export async function setLastSync(timestamp: number): Promise<void> {
	const db = await getDB();
	await db.put('syncMeta', { key: 'lastSync', timestamp });
}

export async function getLastSync(): Promise<number | null> {
	const db = await getDB();
	const meta = await db.get('syncMeta', 'lastSync');
	return meta?.timestamp ?? null;
}

// Clear all data (for logout)
export async function clearAllCachedData(): Promise<void> {
	const db = await getDB();
	await Promise.all([db.clear('wods'), db.clear('sections'), db.clear('syncMeta')]);
}
```

**Step 3: Verify compiles**

Run:
```bash
bun run check
```
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/db/indexeddb.ts
git commit -m "feat: add IndexedDB cache layer for offline support"
```

---

## Task 18: Create Online/Offline Sync Store

**Files:**
- Create: `src/lib/stores/sync.svelte.ts`

**Step 1: Create stores directory**

Run:
```bash
mkdir -p src/lib/stores
```

**Step 2: Create sync store**

Create `src/lib/stores/sync.svelte.ts`:

```typescript
import { browser } from '$app/environment';

class SyncStore {
	#isOnline = $state(browser ? navigator.onLine : true);

	constructor() {
		if (browser) {
			window.addEventListener('online', () => {
				this.#isOnline = true;
			});
			window.addEventListener('offline', () => {
				this.#isOnline = false;
			});
		}
	}

	get isOnline(): boolean {
		return this.#isOnline;
	}

	get isOffline(): boolean {
		return !this.#isOnline;
	}
}

export const syncStore = new SyncStore();
```

**Step 3: Verify compiles**

Run:
```bash
bun run check
```
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/stores/sync.svelte.ts
git commit -m "feat: add online/offline sync store"
```

---

## Task 19: Create Offline Banner Component

**Files:**
- Create: `src/lib/components/OfflineBanner.svelte`

**Step 1: Create components directory**

Run:
```bash
mkdir -p src/lib/components
```

**Step 2: Create offline banner component**

Create `src/lib/components/OfflineBanner.svelte`:

```svelte
<script lang="ts">
	import { syncStore } from '$lib/stores/sync.svelte';
</script>

{#if syncStore.isOffline}
	<div class="bg-yellow-900/80 px-4 py-2 text-center text-sm text-yellow-200">
		You're offline - viewing cached data
	</div>
{/if}
```

**Step 3: Add to app layout**

Modify `src/routes/(app)/+layout.svelte` to include the banner:

Replace entire contents:

```svelte
<script lang="ts">
	import OfflineBanner from '$lib/components/OfflineBanner.svelte';

	let { data, children } = $props();
</script>

<div class="min-h-screen bg-secondary-900">
	<OfflineBanner />

	<header class="border-b border-gray-800 bg-secondary-800 px-4 py-3">
		<div class="mx-auto flex max-w-4xl items-center justify-between">
			<h1 class="text-xl font-bold text-white">RolimBox</h1>
			<div class="flex items-center gap-4">
				<span class="text-sm text-gray-400">{data.user?.email}</span>
				<form action="/logout" method="POST">
					<button type="submit" class="text-sm text-gray-400 transition hover:text-white">
						Logout
					</button>
				</form>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-4xl p-4">
		{@render children()}
	</main>
</div>
```

**Step 4: Verify compiles**

Run:
```bash
bun run check
```
Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/components/OfflineBanner.svelte src/routes/\(app\)/+layout.svelte
git commit -m "feat: add offline banner component"
```

---

## Task 20: Test Full Auth Flow Manually

**Step 1: Start dev server**

Run:
```bash
bun run dev
```

**Step 2: Test registration**

1. Open http://localhost:5173
2. Should redirect to /login
3. Click "Register" link
4. Fill in email and password (min 8 chars)
5. Submit
6. Should redirect to /dashboard

**Step 3: Test logout**

1. Click "Logout" in header
2. Should redirect to /login

**Step 4: Test login**

1. Enter same email and password
2. Submit
3. Should redirect to /dashboard

**Step 5: Test protected routes**

1. Open new incognito window
2. Go to http://localhost:5173/dashboard
3. Should redirect to /login

**Step 6: Verify PWA**

1. Open Chrome DevTools > Application tab
2. Check "Manifest" - should show RolimBox info
3. Check "Service Workers" - should be registered

---

## Task 21: Final Cleanup and Verification

**Step 1: Run type check**

Run:
```bash
bun run check
```
Expected: No errors

**Step 2: Run linter**

Run:
```bash
bun run lint
```
Expected: No errors (or fix any that appear)

**Step 3: Format code**

Run:
```bash
bun run format
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: format and lint Phase 1 code"
```

---

## Summary

Phase 1 is complete. You now have:

- **PWA Foundation**: Manifest, service worker, icons, meta tags
- **Authentication**: Email/password registration, login, logout, protected routes
- **Database Schema**: User, session, workspace, workspace_member, wod, section tables
- **Local Cache**: IndexedDB with WoD and section stores
- **Sync Infrastructure**: Online/offline detection, offline banner
- **Brand Colors**: Tailwind theme with purple/pink palette

**Next Phase**: Phase 2 - WoD Management (create, edit, delete, list workouts)
