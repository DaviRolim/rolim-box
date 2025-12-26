# Multi-User Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable multiple users to share workspaces via invite codes, with workspace switching and member management.

**Architecture:** Add `workspace_invite` table for invite codes. Extend auth module with multi-workspace functions. Create `/join/[code]` page for invite acceptance. Add workspace switcher to header and settings page for member management.

**Tech Stack:** SvelteKit, Drizzle ORM, SQLite, TypeScript, Tailwind CSS

---

## Task 1: Add Workspace Invite Schema

**Files:**
- Modify: `src/lib/server/db/schema.ts`

**Step 1: Add workspace_invite table and update role comment**

Add after the `workspaceMember` table definition:

```typescript
// Workspace invitation codes
export const workspaceInvite = sqliteTable('workspace_invite', {
	id: text('id').primaryKey(),
	code: text('code').notNull().unique(),
	workspaceId: text('workspace_id')
		.notNull()
		.references(() => workspace.id, { onDelete: 'cascade' }),
	role: text('role').notNull(), // 'coach' | 'member'
	createdBy: text('created_by')
		.notNull()
		.references(() => user.id),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

// Type exports (add at bottom with other exports)
export type WorkspaceInvite = typeof workspaceInvite.$inferSelect;
```

Also update the `workspaceMember` role comment from `// 'owner' | 'coach'` to `// 'owner' | 'coach' | 'member'`

**Step 2: Run database migration**

```bash
cd /home/daviholanda/code-projects/svelte/rolimbox && DATABASE_URL="file:local.db" bunx drizzle-kit push
```

Expected: Migration applies successfully, new table created

**Step 3: Commit**

```bash
git add src/lib/server/db/schema.ts
git commit -m "feat(db): add workspace_invite table for invite codes"
```

---

## Task 2: Add Invite Code Generation Utilities

**Files:**
- Modify: `src/lib/server/auth.ts`

**Step 1: Add generateInviteCode function**

Add after `generateId()`:

```typescript
export function generateInviteCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for readability
	let code = '';
	const bytes = crypto.getRandomValues(new Uint8Array(6));
	for (const byte of bytes) {
		code += chars[byte % chars.length];
	}
	// Format as XXX-XXX for readability
	return `${code.slice(0, 3)}-${code.slice(3, 6)}`;
}
```

**Step 2: Verify the function works**

Run the dev server and test in browser console or create a quick test:

```bash
cd /home/daviholanda/code-projects/svelte/rolimbox && bun run dev
```

In another terminal, verify:

```bash
cd /home/daviholanda/code-projects/svelte/rolimbox && bun -e "import { generateInviteCode } from './src/lib/server/auth'; console.log(generateInviteCode());"
```

Expected: Outputs something like `ABC-123`

**Step 3: Commit**

```bash
git add src/lib/server/auth.ts
git commit -m "feat(auth): add invite code generator"
```

---

## Task 3: Add Multi-Workspace Auth Functions

**Files:**
- Modify: `src/lib/server/auth.ts`

**Step 1: Add getUserWorkspaces function**

Add after `getUserWorkspace()`:

```typescript
export async function getUserWorkspaces(userId: string): Promise<(table.Workspace & { role: string })[]> {
	const results = await db
		.select({
			id: table.workspace.id,
			name: table.workspace.name,
			createdAt: table.workspace.createdAt,
			role: table.workspaceMember.role
		})
		.from(table.workspaceMember)
		.innerJoin(table.workspace, eq(table.workspaceMember.workspaceId, table.workspace.id))
		.where(eq(table.workspaceMember.userId, userId));

	return results;
}
```

**Step 2: Add addUserToWorkspace function**

```typescript
export async function addUserToWorkspace(
	userId: string,
	workspaceId: string,
	role: 'coach' | 'member'
): Promise<void> {
	await db.insert(table.workspaceMember).values({
		userId,
		workspaceId,
		role,
		joinedAt: new Date()
	});
}
```

**Step 3: Add isWorkspaceOwner function**

```typescript
export async function isWorkspaceOwner(userId: string, workspaceId: string): Promise<boolean> {
	const [membership] = await db
		.select()
		.from(table.workspaceMember)
		.where(
			and(
				eq(table.workspaceMember.userId, userId),
				eq(table.workspaceMember.workspaceId, workspaceId),
				eq(table.workspaceMember.role, 'owner')
			)
		);
	return !!membership;
}
```

**Step 4: Add import for `and` from drizzle-orm**

Update the import at the top:

```typescript
import { eq, and } from 'drizzle-orm';
```

**Step 5: Commit**

```bash
git add src/lib/server/auth.ts
git commit -m "feat(auth): add multi-workspace functions"
```

---

## Task 4: Add Invite Management Functions

**Files:**
- Modify: `src/lib/server/auth.ts`

**Step 1: Add createWorkspaceInvite function**

```typescript
export async function createWorkspaceInvite(
	workspaceId: string,
	createdBy: string,
	role: 'coach' | 'member'
): Promise<table.WorkspaceInvite> {
	const id = generateId();
	const code = generateInviteCode();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

	const [invite] = await db
		.insert(table.workspaceInvite)
		.values({
			id,
			code,
			workspaceId,
			role,
			createdBy,
			createdAt: now,
			expiresAt
		})
		.returning();

	return invite;
}
```

**Step 2: Add getInviteByCode function**

```typescript
export async function getInviteByCode(code: string): Promise<(table.WorkspaceInvite & { workspaceName: string }) | undefined> {
	const [result] = await db
		.select({
			id: table.workspaceInvite.id,
			code: table.workspaceInvite.code,
			workspaceId: table.workspaceInvite.workspaceId,
			role: table.workspaceInvite.role,
			createdBy: table.workspaceInvite.createdBy,
			createdAt: table.workspaceInvite.createdAt,
			expiresAt: table.workspaceInvite.expiresAt,
			workspaceName: table.workspace.name
		})
		.from(table.workspaceInvite)
		.innerJoin(table.workspace, eq(table.workspaceInvite.workspaceId, table.workspace.id))
		.where(eq(table.workspaceInvite.code, code.toUpperCase()));

	return result;
}
```

**Step 3: Add getWorkspaceInvites function**

```typescript
export async function getWorkspaceInvites(workspaceId: string): Promise<table.WorkspaceInvite[]> {
	const now = new Date();
	return db
		.select()
		.from(table.workspaceInvite)
		.where(
			and(
				eq(table.workspaceInvite.workspaceId, workspaceId),
				gt(table.workspaceInvite.expiresAt, now)
			)
		);
}
```

**Step 4: Add deleteInvite function**

```typescript
export async function deleteInvite(inviteId: string): Promise<void> {
	await db.delete(table.workspaceInvite).where(eq(table.workspaceInvite.id, inviteId));
}
```

**Step 5: Add import for `gt` from drizzle-orm**

Update import:

```typescript
import { eq, and, gt } from 'drizzle-orm';
```

**Step 6: Commit**

```bash
git add src/lib/server/auth.ts
git commit -m "feat(auth): add invite management functions"
```

---

## Task 5: Create Public Invite Validation API

**Files:**
- Create: `src/routes/api/invites/[code]/+server.ts`

**Step 1: Create the API endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as auth from '$lib/server/auth';

/**
 * GET /api/invites/[code]
 * Public endpoint to validate an invite code
 * Returns workspace name and role if valid
 */
export const GET: RequestHandler = async ({ params }) => {
	const { code } = params;

	if (!code) {
		return json({ error: 'Invite code is required' }, { status: 400 });
	}

	const invite = await auth.getInviteByCode(code);

	if (!invite) {
		return json({ error: 'Invalid invite code' }, { status: 404 });
	}

	// Check expiration
	if (new Date() > invite.expiresAt) {
		return json({ error: 'This invite has expired. Ask for a new one.' }, { status: 410 });
	}

	return json({
		workspaceName: invite.workspaceName,
		role: invite.role,
		code: invite.code
	});
};
```

**Step 2: Test the endpoint**

Start dev server and test with curl:

```bash
curl http://localhost:5173/api/invites/INVALID-CODE
```

Expected: `{"error":"Invalid invite code"}` with status 404

**Step 3: Commit**

```bash
git add src/routes/api/invites/
git commit -m "feat(api): add public invite validation endpoint"
```

---

## Task 6: Create Accept Invite API

**Files:**
- Create: `src/routes/api/invites/[code]/accept/+server.ts`

**Step 1: Create the accept endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workspaceMember } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import * as auth from '$lib/server/auth';

/**
 * POST /api/invites/[code]/accept
 * Accepts an invite and adds user to workspace
 * Requires authentication
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { code } = params;

	if (!code) {
		return json({ error: 'Invite code is required' }, { status: 400 });
	}

	const invite = await auth.getInviteByCode(code);

	if (!invite) {
		return json({ error: 'Invalid invite code' }, { status: 404 });
	}

	if (new Date() > invite.expiresAt) {
		return json({ error: 'This invite has expired. Ask for a new one.' }, { status: 410 });
	}

	// Check if user is already a member
	const [existingMembership] = await db
		.select()
		.from(workspaceMember)
		.where(
			and(
				eq(workspaceMember.userId, locals.user.id),
				eq(workspaceMember.workspaceId, invite.workspaceId)
			)
		);

	if (existingMembership) {
		return json({
			error: 'You are already a member of this workspace',
			workspaceId: invite.workspaceId
		}, { status: 409 });
	}

	// Add user to workspace
	await auth.addUserToWorkspace(locals.user.id, invite.workspaceId, invite.role as 'coach' | 'member');

	return json({
		success: true,
		workspaceId: invite.workspaceId,
		workspaceName: invite.workspaceName,
		role: invite.role
	});
};
```

**Step 2: Commit**

```bash
git add src/routes/api/invites/
git commit -m "feat(api): add accept invite endpoint"
```

---

## Task 7: Create Join Page

**Files:**
- Create: `src/routes/join/[code]/+page.server.ts`
- Create: `src/routes/join/[code]/+page.svelte`

**Step 1: Create the page server load**

```typescript
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import { workspaceMember } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { code } = params;

	const invite = await auth.getInviteByCode(code);

	if (!invite) {
		return { error: 'invalid', invite: null, isLoggedIn: !!locals.user, alreadyMember: false };
	}

	if (new Date() > invite.expiresAt) {
		return { error: 'expired', invite: null, isLoggedIn: !!locals.user, alreadyMember: false };
	}

	// Check if logged-in user is already a member
	let alreadyMember = false;
	if (locals.user) {
		const [existing] = await db
			.select()
			.from(workspaceMember)
			.where(
				and(
					eq(workspaceMember.userId, locals.user.id),
					eq(workspaceMember.workspaceId, invite.workspaceId)
				)
			);
		alreadyMember = !!existing;
	}

	return {
		error: null,
		invite: {
			code: invite.code,
			workspaceName: invite.workspaceName,
			role: invite.role,
			workspaceId: invite.workspaceId
		},
		isLoggedIn: !!locals.user,
		alreadyMember
	};
};
```

**Step 2: Create the page component**

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';

	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleJoin() {
		if (data.isLoggedIn) {
			// Accept invite via API
			loading = true;
			error = '';
			try {
				const res = await fetch(`/api/invites/${data.invite?.code}/accept`, {
					method: 'POST'
				});
				const result = await res.json();
				if (res.ok) {
					// Store as active workspace and redirect
					localStorage.setItem('activeWorkspaceId', result.workspaceId);
					goto('/workouts');
				} else {
					error = result.error;
				}
			} catch {
				error = 'Failed to join workspace';
			} finally {
				loading = false;
			}
		}
	}

	async function handleRegister(event: Event) {
		event.preventDefault();
		loading = true;
		error = '';

		try {
			const formData = new FormData();
			formData.append('email', email);
			formData.append('password', password);
			formData.append('inviteCode', data.invite?.code || '');

			const res = await fetch('/join/' + data.invite?.code, {
				method: 'POST',
				body: formData
			});

			if (res.redirected) {
				window.location.href = res.url;
			} else {
				const result = await res.json();
				error = result.error || 'Registration failed';
			}
		} catch {
			error = 'Registration failed';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-bg-base px-4">
	<div class="w-full max-w-md">
		{#if data.error === 'invalid'}
			<div class="rounded-xl border border-error/20 bg-error/5 p-8 text-center">
				<h1 class="text-xl font-bold text-error">Invalid Invite</h1>
				<p class="mt-2 text-text-secondary">This invite code doesn't exist or has been revoked.</p>
				<a href="/login" class="mt-4 inline-block text-accent-400 hover:underline">Go to login</a>
			</div>
		{:else if data.error === 'expired'}
			<div class="rounded-xl border border-warning/20 bg-warning/5 p-8 text-center">
				<h1 class="text-xl font-bold text-warning">Invite Expired</h1>
				<p class="mt-2 text-text-secondary">This invite has expired. Ask for a new one.</p>
				<a href="/login" class="mt-4 inline-block text-accent-400 hover:underline">Go to login</a>
			</div>
		{:else if data.alreadyMember}
			<div class="rounded-xl border border-accent-500/20 bg-accent-500/5 p-8 text-center">
				<h1 class="text-xl font-bold text-accent-400">Already a Member</h1>
				<p class="mt-2 text-text-secondary">
					You're already a member of <strong>{data.invite?.workspaceName}</strong>.
				</p>
				<a href="/workouts" class="mt-4 inline-block rounded-lg bg-accent-500 px-4 py-2 font-bold text-white hover:bg-accent-600">
					Go to Workouts
				</a>
			</div>
		{:else if data.isLoggedIn}
			<!-- Logged in: show confirmation -->
			<div class="rounded-xl border border-white/10 bg-bg-surface p-8">
				<h1 class="text-center text-2xl font-bold text-white">Join Workspace</h1>
				<div class="mt-6 rounded-lg border border-white/5 bg-white/5 p-4 text-center">
					<p class="text-sm text-text-secondary">You've been invited to join</p>
					<p class="mt-1 text-xl font-bold text-white">{data.invite?.workspaceName}</p>
					<p class="mt-2 text-sm text-text-muted">
						as <span class="font-medium text-accent-400">{data.invite?.role}</span>
					</p>
				</div>

				{#if error}
					<p class="mt-4 text-center text-sm text-error">{error}</p>
				{/if}

				<button
					onclick={handleJoin}
					disabled={loading}
					class="mt-6 w-full rounded-lg bg-accent-500 py-3 font-bold text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
				>
					{loading ? 'Joining...' : 'Join Workspace'}
				</button>
			</div>
		{:else}
			<!-- Not logged in: show registration form -->
			<div class="rounded-xl border border-white/10 bg-bg-surface p-8">
				<h1 class="text-center text-2xl font-bold text-white">Join Workspace</h1>
				<div class="mt-4 rounded-lg border border-white/5 bg-white/5 p-4 text-center">
					<p class="text-sm text-text-secondary">You've been invited to join</p>
					<p class="mt-1 text-xl font-bold text-white">{data.invite?.workspaceName}</p>
					<p class="mt-2 text-sm text-text-muted">
						as <span class="font-medium text-accent-400">{data.invite?.role}</span>
					</p>
				</div>

				<form onsubmit={handleRegister} class="mt-6 space-y-4">
					<div>
						<label for="email" class="block text-sm font-medium text-text-secondary">Email</label>
						<input
							type="email"
							id="email"
							bind:value={email}
							required
							class="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-text-muted focus:border-accent-500 focus:outline-none"
							placeholder="you@example.com"
						/>
					</div>
					<div>
						<label for="password" class="block text-sm font-medium text-text-secondary">Password</label>
						<input
							type="password"
							id="password"
							bind:value={password}
							required
							minlength="8"
							class="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-text-muted focus:border-accent-500 focus:outline-none"
							placeholder="At least 8 characters"
						/>
					</div>

					{#if error}
						<p class="text-center text-sm text-error">{error}</p>
					{/if}

					<button
						type="submit"
						disabled={loading}
						class="w-full rounded-lg bg-accent-500 py-3 font-bold text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
					>
						{loading ? 'Creating account...' : 'Create Account & Join'}
					</button>
				</form>

				<p class="mt-4 text-center text-sm text-text-muted">
					Already have an account?
					<a href="/login?redirect=/join/{data.invite?.code}" class="text-accent-400 hover:underline">Log in</a>
				</p>
			</div>
		{/if}
	</div>
</div>
```

**Step 3: Add form action for registration with invite**

Add to `+page.server.ts`:

```typescript
import { fail } from '@sveltejs/kit';

export const actions: Actions = {
	default: async ({ request, params, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email');
		const password = formData.get('password');
		const inviteCode = params.code;

		if (typeof email !== 'string' || !email.includes('@')) {
			return fail(400, { error: 'Invalid email address' });
		}

		if (typeof password !== 'string' || password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters' });
		}

		// Validate invite
		const invite = await auth.getInviteByCode(inviteCode);
		if (!invite || new Date() > invite.expiresAt) {
			return fail(400, { error: 'Invalid or expired invite' });
		}

		// Check if email exists
		const existingUser = await auth.findUserByEmail(email);
		if (existingUser) {
			return fail(400, { error: 'Email already registered. Please log in instead.' });
		}

		// Create user (without personal workspace)
		const user = await auth.createUser(email, password);

		// Add to invited workspace
		await auth.addUserToWorkspace(user.id, invite.workspaceId, invite.role as 'coach' | 'member');

		// Create session
		const token = auth.generateSessionToken();
		const session = await auth.createSession(token, user.id);

		cookies.set(auth.sessionCookieName, token, {
			expires: session.expiresAt,
			path: '/'
		});

		throw redirect(302, '/workouts');
	}
};
```

**Step 4: Commit**

```bash
git add src/routes/join/
git commit -m "feat: add join page for invite acceptance"
```

---

## Task 8: Update App Layout for Multiple Workspaces

**Files:**
- Modify: `src/routes/(app)/+layout.server.ts`

**Step 1: Load all workspaces instead of one**

Replace the file contents:

```typescript
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import * as auth from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const workspaces = await auth.getUserWorkspaces(locals.user.id);

	// Get active workspace from cookie, or default to first
	let activeWorkspaceId = cookies.get('activeWorkspaceId');

	// Validate activeWorkspaceId exists in user's workspaces
	const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
	if (!activeWorkspace && workspaces.length > 0) {
		activeWorkspaceId = workspaces[0].id;
	}

	return {
		user: locals.user,
		workspaces,
		activeWorkspaceId
	};
};
```

**Step 2: Commit**

```bash
git add src/routes/(app)/+layout.server.ts
git commit -m "feat: load all user workspaces in app layout"
```

---

## Task 9: Create Workspace Switcher Component

**Files:**
- Create: `src/lib/components/WorkspaceSwitcher.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	type Workspace = {
		id: string;
		name: string;
		role: string;
	};

	let { workspaces, activeWorkspaceId }: { workspaces: Workspace[]; activeWorkspaceId: string | undefined } = $props();

	let isOpen = $state(false);

	const activeWorkspace = $derived(workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0]);

	async function switchWorkspace(workspaceId: string) {
		// Update localStorage
		localStorage.setItem('activeWorkspaceId', workspaceId);

		// Update cookie via API
		await fetch('/api/workspaces/active', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ workspaceId })
		});

		isOpen = false;

		// Reload page data
		invalidateAll();
	}

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.workspace-switcher')) {
			isOpen = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="workspace-switcher relative">
	{#if workspaces.length <= 1}
		<!-- Single workspace: just show name -->
		<div class="flex flex-col items-end">
			<span class="text-[10px] font-bold tracking-widest text-accent-400 uppercase">Workspace</span>
			<span class="text-xs font-medium text-text-secondary">{activeWorkspace?.name || 'No workspace'}</span>
		</div>
	{:else}
		<!-- Multiple workspaces: show dropdown -->
		<button
			onclick={toggleDropdown}
			class="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 transition-colors hover:bg-white/10"
		>
			<div class="flex flex-col items-start">
				<span class="text-[10px] font-bold tracking-widest text-accent-400 uppercase">Workspace</span>
				<span class="text-xs font-medium text-text-secondary">{activeWorkspace?.name}</span>
			</div>
			<svg class="h-4 w-4 text-text-muted transition-transform" class:rotate-180={isOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		{#if isOpen}
			<div class="absolute right-0 top-full z-50 mt-2 min-w-48 rounded-lg border border-white/10 bg-bg-surface shadow-xl">
				{#each workspaces as workspace}
					<button
						onclick={() => switchWorkspace(workspace.id)}
						class="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-white/5"
						class:bg-accent-500/10={workspace.id === activeWorkspaceId}
					>
						<span class="font-medium text-white">{workspace.name}</span>
						<span class="text-xs text-text-muted">{workspace.role}</span>
					</button>
				{/each}
				<div class="border-t border-white/5">
					<a
						href="/settings/workspace"
						class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
						Workspace Settings
					</a>
				</div>
			</div>
		{/if}
	{/if}
</div>
```

**Step 2: Commit**

```bash
git add src/lib/components/WorkspaceSwitcher.svelte
git commit -m "feat: add WorkspaceSwitcher component"
```

---

## Task 10: Create Active Workspace API

**Files:**
- Create: `src/routes/api/workspaces/active/+server.ts`

**Step 1: Create the endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST /api/workspaces/active
 * Sets the active workspace cookie
 */
export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const { workspaceId } = body;

	if (!workspaceId) {
		return json({ error: 'workspaceId is required' }, { status: 400 });
	}

	// Set cookie (30 days)
	cookies.set('activeWorkspaceId', workspaceId, {
		path: '/',
		maxAge: 60 * 60 * 24 * 30
	});

	return json({ success: true });
};
```

**Step 2: Commit**

```bash
git add src/routes/api/workspaces/
git commit -m "feat(api): add active workspace endpoint"
```

---

## Task 11: Update App Layout to Use WorkspaceSwitcher

**Files:**
- Modify: `src/routes/(app)/+layout.svelte`

**Step 1: Replace workspace display with WorkspaceSwitcher**

Update the import section and replace the workspace display:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { audioService } from '$lib/services/audio.svelte';
	import OfflineBanner from '$lib/components/OfflineBanner.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import WorkspaceSwitcher from '$lib/components/WorkspaceSwitcher.svelte';

	let { data, children } = $props();

	onMount(() => {
		// Defer audio preloading to avoid blocking initial render
		if ('requestIdleCallback' in window) {
			requestIdleCallback(() => audioService.preload());
		} else {
			// Fallback for Safari
			setTimeout(() => audioService.preload(), 1000);
		}
	});
</script>

<div class="min-h-screen bg-bg-base text-text-primary">
	<OfflineBanner />

	<header
		class="sticky top-0 z-50 border-b border-white/5 bg-bg-surface/50 px-4 py-4 backdrop-blur-md"
	>
		<div class="mx-auto flex max-w-6xl items-center justify-between">
			<a href="/dashboard" class="flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-600 font-black text-white shadow-lg shadow-accent-500/20"
				>
					R
				</div>
				<h1 class="text-xl font-black tracking-tighter text-white uppercase italic">RolimBox</h1>
			</a>
			<div class="flex items-center gap-4">
				<div class="hidden sm:block">
					<WorkspaceSwitcher workspaces={data.workspaces} activeWorkspaceId={data.activeWorkspaceId} />
				</div>
				<form action="/logout" method="POST">
					<button
						type="submit"
						class="glass-hover rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-xs font-bold tracking-wider text-text-muted uppercase transition-all hover:border-error/30 hover:bg-error/5 hover:text-error"
					>
						Logout
					</button>
				</form>
			</div>
		</div>
	</header>

	<main class="mx-auto min-h-[calc(100vh-140px)] max-w-6xl">
		{@render children()}
	</main>

	<BottomNav />
</div>
```

**Step 2: Commit**

```bash
git add src/routes/(app)/+layout.svelte
git commit -m "feat: integrate WorkspaceSwitcher into app layout"
```

---

## Task 12: Create Workspace Invites API

**Files:**
- Create: `src/routes/api/workspaces/[id]/invites/+server.ts`

**Step 1: Create the invites endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as auth from '$lib/server/auth';

/**
 * GET /api/workspaces/[id]/invites
 * List active invites (owner only)
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id: workspaceId } = params;

	// Check if user is owner
	const isOwner = await auth.isWorkspaceOwner(locals.user.id, workspaceId);
	if (!isOwner) {
		return json({ error: 'Only workspace owners can view invites' }, { status: 403 });
	}

	const invites = await auth.getWorkspaceInvites(workspaceId);

	return json(invites);
};

/**
 * POST /api/workspaces/[id]/invites
 * Create a new invite (owner only)
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id: workspaceId } = params;

	// Check if user is owner
	const isOwner = await auth.isWorkspaceOwner(locals.user.id, workspaceId);
	if (!isOwner) {
		return json({ error: 'Only workspace owners can create invites' }, { status: 403 });
	}

	const body = await request.json();
	const role = body.role as 'coach' | 'member';

	if (!role || !['coach', 'member'].includes(role)) {
		return json({ error: 'Invalid role. Must be "coach" or "member"' }, { status: 400 });
	}

	const invite = await auth.createWorkspaceInvite(workspaceId, locals.user.id, role);

	return json(invite, { status: 201 });
};
```

**Step 2: Create delete endpoint**

Create `src/routes/api/workspaces/[id]/invites/[code]/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import { workspaceInvite } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * DELETE /api/workspaces/[id]/invites/[code]
 * Revoke an invite (owner only)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id: workspaceId, code } = params;

	// Check if user is owner
	const isOwner = await auth.isWorkspaceOwner(locals.user.id, workspaceId);
	if (!isOwner) {
		return json({ error: 'Only workspace owners can revoke invites' }, { status: 403 });
	}

	// Find and delete the invite
	const [invite] = await db
		.select()
		.from(workspaceInvite)
		.where(
			and(
				eq(workspaceInvite.workspaceId, workspaceId),
				eq(workspaceInvite.code, code)
			)
		);

	if (!invite) {
		return json({ error: 'Invite not found' }, { status: 404 });
	}

	await auth.deleteInvite(invite.id);

	return json({ success: true });
};
```

**Step 3: Commit**

```bash
git add src/routes/api/workspaces/
git commit -m "feat(api): add workspace invites management endpoints"
```

---

## Task 13: Create Workspace Members API

**Files:**
- Create: `src/routes/api/workspaces/[id]/members/+server.ts`
- Create: `src/routes/api/workspaces/[id]/members/[userId]/+server.ts`

**Step 1: Create members list endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workspaceMember, user } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/workspaces/[id]/members
 * List workspace members
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id: workspaceId } = params;

	// Check if user is a member
	const [membership] = await db
		.select()
		.from(workspaceMember)
		.where(
			and(
				eq(workspaceMember.userId, locals.user.id),
				eq(workspaceMember.workspaceId, workspaceId)
			)
		);

	if (!membership) {
		return json({ error: 'Not a member of this workspace' }, { status: 403 });
	}

	// Get all members with user info
	const members = await db
		.select({
			userId: workspaceMember.userId,
			email: user.email,
			role: workspaceMember.role,
			joinedAt: workspaceMember.joinedAt
		})
		.from(workspaceMember)
		.innerJoin(user, eq(workspaceMember.userId, user.id))
		.where(eq(workspaceMember.workspaceId, workspaceId));

	return json(members);
};
```

**Step 2: Create member removal endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workspaceMember } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import * as auth from '$lib/server/auth';

/**
 * DELETE /api/workspaces/[id]/members/[userId]
 * Remove a member (owner only, cannot remove self if sole owner)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id: workspaceId, userId } = params;

	// Check if requester is owner
	const isOwner = await auth.isWorkspaceOwner(locals.user.id, workspaceId);
	if (!isOwner) {
		return json({ error: 'Only workspace owners can remove members' }, { status: 403 });
	}

	// Check if trying to remove self
	if (userId === locals.user.id) {
		// Count other owners
		const owners = await db
			.select()
			.from(workspaceMember)
			.where(
				and(
					eq(workspaceMember.workspaceId, workspaceId),
					eq(workspaceMember.role, 'owner')
				)
			);

		if (owners.length <= 1) {
			return json({ error: 'Cannot remove yourself as the sole owner. Transfer ownership first.' }, { status: 400 });
		}
	}

	// Remove member
	await db
		.delete(workspaceMember)
		.where(
			and(
				eq(workspaceMember.userId, userId),
				eq(workspaceMember.workspaceId, workspaceId)
			)
		);

	return json({ success: true });
};
```

**Step 3: Commit**

```bash
git add src/routes/api/workspaces/
git commit -m "feat(api): add workspace members management endpoints"
```

---

## Task 14: Create Workspace Settings Page

**Files:**
- Create: `src/routes/(app)/settings/workspace/+page.server.ts`
- Create: `src/routes/(app)/settings/workspace/+page.svelte`

**Step 1: Create page server**

```typescript
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import { workspaceMember, user, workspace } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const activeWorkspaceId = cookies.get('activeWorkspaceId');

	if (!activeWorkspaceId) {
		throw redirect(302, '/workouts');
	}

	// Get workspace details
	const [workspaceData] = await db
		.select()
		.from(workspace)
		.where(eq(workspace.id, activeWorkspaceId));

	if (!workspaceData) {
		throw redirect(302, '/workouts');
	}

	// Check if user is owner
	const isOwner = await auth.isWorkspaceOwner(locals.user.id, activeWorkspaceId);

	// Get members
	const members = await db
		.select({
			userId: workspaceMember.userId,
			email: user.email,
			role: workspaceMember.role,
			joinedAt: workspaceMember.joinedAt
		})
		.from(workspaceMember)
		.innerJoin(user, eq(workspaceMember.userId, user.id))
		.where(eq(workspaceMember.workspaceId, activeWorkspaceId));

	// Get active invites if owner
	let invites: Awaited<ReturnType<typeof auth.getWorkspaceInvites>> = [];
	if (isOwner) {
		invites = await auth.getWorkspaceInvites(activeWorkspaceId);
	}

	return {
		workspace: workspaceData,
		members,
		invites,
		isOwner,
		currentUserId: locals.user.id
	};
};
```

**Step 2: Create page component**

```svelte
<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let creatingInvite = $state(false);
	let inviteRole = $state<'coach' | 'member'>('member');
	let newInviteCode = $state('');
	let copySuccess = $state(false);

	async function createInvite() {
		creatingInvite = true;
		try {
			const res = await fetch(`/api/workspaces/${data.workspace.id}/invites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: inviteRole })
			});
			const result = await res.json();
			if (res.ok) {
				newInviteCode = result.code;
				invalidateAll();
			}
		} finally {
			creatingInvite = false;
		}
	}

	async function revokeInvite(code: string) {
		await fetch(`/api/workspaces/${data.workspace.id}/invites/${code}`, {
			method: 'DELETE'
		});
		invalidateAll();
	}

	async function removeMember(userId: string) {
		if (!confirm('Remove this member from the workspace?')) return;

		await fetch(`/api/workspaces/${data.workspace.id}/members/${userId}`, {
			method: 'DELETE'
		});
		invalidateAll();
	}

	function getInviteLink(code: string) {
		return `${window.location.origin}/join/${code}`;
	}

	async function copyInviteLink(code: string) {
		await navigator.clipboard.writeText(getInviteLink(code));
		copySuccess = true;
		setTimeout(() => copySuccess = false, 2000);
	}

	function formatDate(date: Date) {
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(date));
	}
</script>

<div class="p-4">
	<h1 class="text-2xl font-bold text-white">Workspace Settings</h1>
	<p class="mt-1 text-text-secondary">{data.workspace.name}</p>

	<!-- Invite Section (Owner Only) -->
	{#if data.isOwner}
		<section class="mt-8">
			<h2 class="text-lg font-bold text-white">Invite Members</h2>

			<div class="mt-4 flex flex-wrap gap-4">
				<select
					bind:value={inviteRole}
					class="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white"
				>
					<option value="member">Member (view only)</option>
					<option value="coach">Coach (can edit)</option>
				</select>
				<button
					onclick={createInvite}
					disabled={creatingInvite}
					class="rounded-lg bg-accent-500 px-4 py-2 font-bold text-white hover:bg-accent-600 disabled:opacity-50"
				>
					{creatingInvite ? 'Creating...' : 'Generate Invite Link'}
				</button>
			</div>

			{#if newInviteCode}
				<div class="mt-4 rounded-lg border border-accent-500/30 bg-accent-500/10 p-4">
					<p class="text-sm text-text-secondary">Share this link:</p>
					<div class="mt-2 flex items-center gap-2">
						<code class="flex-1 rounded bg-black/30 px-3 py-2 text-sm text-white">
							{getInviteLink(newInviteCode)}
						</code>
						<button
							onclick={() => copyInviteLink(newInviteCode)}
							class="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
						>
							{copySuccess ? 'Copied!' : 'Copy'}
						</button>
					</div>
					<p class="mt-2 text-xs text-text-muted">Expires in 7 days</p>
				</div>
			{/if}

			<!-- Active Invites -->
			{#if data.invites.length > 0}
				<div class="mt-6">
					<h3 class="text-sm font-bold text-text-secondary uppercase">Active Invites</h3>
					<div class="mt-2 space-y-2">
						{#each data.invites as invite}
							<div class="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
								<div>
									<code class="text-sm text-white">{invite.code}</code>
									<span class="ml-2 text-xs text-text-muted">({invite.role})</span>
								</div>
								<div class="flex items-center gap-2">
									<span class="text-xs text-text-muted">
										Expires {formatDate(invite.expiresAt)}
									</span>
									<button
										onclick={() => revokeInvite(invite.code)}
										class="text-xs text-error hover:underline"
									>
										Revoke
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</section>
	{/if}

	<!-- Members Section -->
	<section class="mt-8">
		<h2 class="text-lg font-bold text-white">Members</h2>
		<div class="mt-4 space-y-2">
			{#each data.members as member}
				<div class="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-4">
					<div>
						<p class="font-medium text-white">{member.email}</p>
						<p class="text-xs text-text-muted">
							{member.role} · Joined {formatDate(member.joinedAt)}
						</p>
					</div>
					{#if data.isOwner && member.userId !== data.currentUserId}
						<button
							onclick={() => removeMember(member.userId)}
							class="text-sm text-error hover:underline"
						>
							Remove
						</button>
					{/if}
					{#if member.userId === data.currentUserId}
						<span class="text-xs text-text-muted">(you)</span>
					{/if}
				</div>
			{/each}
		</div>
	</section>
</div>
```

**Step 3: Commit**

```bash
git add src/routes/(app)/settings/
git commit -m "feat: add workspace settings page with invite and member management"
```

---

## Task 15: Update Workouts Page to Use Active Workspace

**Files:**
- Modify: `src/routes/(app)/workouts/+page.server.ts`
- Modify: `src/routes/(app)/workouts/+page.svelte`

**Step 1: Update page server to get workspaceId from cookie**

Read the current file and update it to use the cookie:

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, parent }) => {
	const parentData = await parent();
	const workspaceId = cookies.get('activeWorkspaceId') || parentData.activeWorkspaceId;

	return {
		workspaceId
	};
};
```

**Step 2: Verify the workouts page uses workspaceId correctly**

The existing `+page.svelte` should already use `data.workspaceId` to fetch WoDs. Verify this is working.

**Step 3: Commit**

```bash
git add src/routes/(app)/workouts/
git commit -m "fix: ensure workouts page uses active workspace from cookie"
```

---

## Task 16: Add Role-Based Permissions for WoD Editing

**Files:**
- Modify: `src/routes/api/wods/+server.ts`
- Modify: `src/routes/api/wods/[id]/+server.ts`

**Step 1: Update POST to check role permissions**

In the POST handler, after checking membership, add role check:

```typescript
// Check if user has edit permissions (owner or coach only)
if (membership.role === 'member') {
	return json({ error: 'Members cannot create workouts' }, { status: 403 });
}
```

**Step 2: Update PUT/DELETE in [id]/+server.ts similarly**

Add the same role check for edit and delete operations.

**Step 3: Commit**

```bash
git add src/routes/api/wods/
git commit -m "feat: add role-based permissions for WoD operations"
```

---

## Task 17: Handle No Workspace State

**Files:**
- Create: `src/routes/(app)/no-workspace/+page.svelte`
- Modify: `src/routes/(app)/+layout.server.ts`

**Step 1: Create no-workspace page**

```svelte
<script lang="ts">
	let inviteCode = $state('');
	let error = $state('');
	let loading = $state(false);

	async function joinWithCode() {
		if (!inviteCode.trim()) return;

		loading = true;
		error = '';

		// Redirect to join page
		window.location.href = `/join/${inviteCode.trim().toUpperCase()}`;
	}
</script>

<div class="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
	<h1 class="text-2xl font-bold text-white">No Workspace</h1>
	<p class="mt-2 text-text-secondary">You're not part of any workspace yet.</p>

	<div class="mt-8 w-full max-w-sm">
		<p class="text-sm text-text-muted">Have an invite code?</p>
		<div class="mt-2 flex gap-2">
			<input
				type="text"
				bind:value={inviteCode}
				placeholder="ABC-123"
				class="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-center text-white uppercase placeholder-text-muted"
			/>
			<button
				onclick={joinWithCode}
				disabled={loading || !inviteCode.trim()}
				class="rounded-lg bg-accent-500 px-4 py-2 font-bold text-white hover:bg-accent-600 disabled:opacity-50"
			>
				Join
			</button>
		</div>

		{#if error}
			<p class="mt-2 text-sm text-error">{error}</p>
		{/if}
	</div>
</div>
```

**Step 2: Update layout to redirect if no workspaces**

In `+layout.server.ts`, add after getting workspaces:

```typescript
// If user has no workspaces, let them through to see the no-workspace page
// But set a flag so child pages can handle it
if (workspaces.length === 0) {
	return {
		user: locals.user,
		workspaces: [],
		activeWorkspaceId: undefined,
		hasNoWorkspace: true
	};
}
```

**Step 3: Commit**

```bash
git add src/routes/(app)/no-workspace/ src/routes/(app)/+layout.server.ts
git commit -m "feat: handle no-workspace state for users who left all workspaces"
```

---

## Task 18: Manual Testing Checklist

**Step 1: Test invite creation**
- Log in as existing user (workspace owner)
- Go to `/settings/workspace`
- Generate invite link
- Verify link format: `http://localhost:5173/join/XXX-XXX`

**Step 2: Test new user registration via invite**
- Open incognito/private window
- Paste invite link
- Register with new email
- Verify: lands in workspace, no personal workspace created

**Step 3: Test existing user joining via invite**
- Create another invite
- Log in as different existing user
- Paste invite link
- Verify: joins workspace, can switch between workspaces

**Step 4: Test workspace switching**
- As user with multiple workspaces
- Click workspace switcher in header
- Switch to different workspace
- Verify: WoDs list updates to show correct workspace's workouts

**Step 5: Test member removal**
- As workspace owner
- Go to settings
- Remove a member
- Verify: member no longer sees workspace

**Step 6: Commit final verification**

```bash
git add -A
git commit -m "test: complete manual testing of multi-user workspace feature"
```

---

## Summary

This plan implements multi-user workspaces in 18 tasks:

1. **Tasks 1-4:** Database schema and auth functions
2. **Tasks 5-6:** Public invite validation and accept APIs
3. **Task 7:** Join page for new and existing users
4. **Tasks 8-11:** App layout updates with workspace switcher
5. **Tasks 12-13:** Invite and member management APIs
6. **Task 14:** Workspace settings page UI
7. **Tasks 15-16:** Workouts integration and role permissions
8. **Task 17:** No-workspace edge case handling
9. **Task 18:** Manual testing verification

Each task is atomic and can be committed independently. The feature can be deployed incrementally.
