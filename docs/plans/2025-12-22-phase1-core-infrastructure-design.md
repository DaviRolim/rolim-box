# Phase 1: Core Infrastructure - Design Document

**Date**: December 22, 2025
**Status**: Approved
**Reference**: [Development Phases Spec](../specs/development_phases_spec.md)

---

## Overview

Phase 1 establishes the foundational architecture for RolimBox: PWA setup, authentication, database schema, and data sync infrastructure.

### Key Decisions Made

| Decision        | Choice                 | Rationale                                                      |
| --------------- | ---------------------- | -------------------------------------------------------------- |
| Cloud backend   | Turso (SQLite)         | Already configured, avoids adding services                     |
| Offline mode    | Read-only              | Simplifies sync, avoids conflicts between shared account users |
| User auth       | Email + password       | Simple, enables future password reset                          |
| UI approach     | Minimal + brand colors | Focus on functionality, polish in Phase 5                      |
| Multi-user prep | Workspace model        | Schema supports future team features                           |

---

## 1. Project Structure

```
src/
├── lib/
│   ├── server/
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle schema definitions
│   │   │   └── index.ts         # Turso connection
│   │   └── auth.ts              # Session management
│   ├── stores/
│   │   └── sync.svelte.ts       # Online/offline state, sync status
│   └── db/
│       └── indexeddb.ts         # Local cache layer
├── routes/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── +page.svelte     # Login form
│   │   ├── register/
│   │   │   └── +page.svelte     # Registration form
│   │   └── +layout.svelte       # Auth layout (redirect if logged in)
│   ├── (app)/
│   │   ├── +layout.svelte       # Protected layout (requires auth)
│   │   ├── +layout.server.ts    # Load user session, workspace data
│   │   ├── +page.svelte         # Dashboard
│   │   └── logout/
│   │       └── +page.server.ts  # Logout action
│   └── +layout.svelte           # Root layout with PWA meta tags
├── hooks.server.ts              # Session validation middleware
└── app.d.ts                     # Type definitions
static/
├── manifest.json                # PWA manifest
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── sw.js                        # Service worker
```

---

## 2. Database Schema

### Turso (SQLite) Tables

```typescript
// src/lib/server/db/schema.ts

// User account
export const user = sqliteTable('user', {
	id: text('id').primaryKey(), // UUID
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

// Session (existing, no changes)
export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

// Workspace (for future multi-user support)
export const workspace = sqliteTable('workspace', {
	id: text('id').primaryKey(), // UUID
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
	(table) => ({
		pk: primaryKey({ columns: [table.userId, table.workspaceId] })
	})
);

// Workout of the Day
export const wod = sqliteTable('wod', {
	id: text('id').primaryKey(), // UUID
	workspaceId: text('workspace_id')
		.notNull()
		.references(() => workspace.id),
	date: text('date').notNull(), // ISO date: "2025-12-22"
	description: text('description'), // nullable
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

// WoD Sections
export const section = sqliteTable('section', {
	id: text('id').primaryKey(), // UUID
	wodId: text('wod_id')
		.notNull()
		.references(() => wod.id, { onDelete: 'cascade' }),
	type: text('type').notNull(), // 'warmup'|'skill'|'wod'|'cooldown'|'stretches'|'custom'
	name: text('name').notNull(), // Display name
	content: text('content').notNull().default(''),
	order: integer('order').notNull(), // Position in WoD (0-indexed)
	timerConfig: text('timer_config') // nullable, JSON string
});
```

### IndexedDB Schema (Local Cache)

```typescript
// src/lib/db/indexeddb.ts

interface IDBSchema {
	wods: {
		key: string; // wod.id
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
		key: string; // section.id
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
		key: string; // 'lastSync'
		value: {
			key: string;
			timestamp: number;
		};
	};
}
```

---

## 3. Authentication Flow

### Registration

```
POST /register
├── Input: { email, password }
├── Validate:
│   ├── Email format
│   └── Password min 8 characters
├── Hash password (Argon2)
├── Create user
├── Create workspace ("My Workspace")
├── Create workspace_member (role: "owner")
├── Create session
├── Set cookie
└── Redirect to /
```

### Login

```
POST /login
├── Input: { email, password }
├── Find user by email
├── Verify password hash
├── Create session
├── Set cookie
└── Redirect to /
```

### Logout

```
POST /logout
├── Get session from cookie
├── Delete session from database
├── Clear cookie
└── Redirect to /login
```

### Protected Routes

```typescript
// src/hooks.server.ts
export const handle: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get('auth-session');

	if (sessionToken) {
		const { session, user } = await validateSessionToken(sessionToken);
		event.locals.session = session;
		event.locals.user = user;
	}

	return resolve(event);
};

// src/routes/(app)/+layout.server.ts
export const load: LayoutServerLoad = async ({ locals, redirect }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Load user's workspace
	const membership = await db.query.workspaceMember.findFirst({
		where: eq(workspaceMember.userId, locals.user.id),
		with: { workspace: true }
	});

	return {
		user: locals.user,
		workspace: membership?.workspace
	};
};
```

---

## 4. Data Sync Strategy

### Sync Flow

```
App Load
    │
    ▼
┌─────────────────┐
│ Check online    │
│ navigator.onLine│
└─────────────────┘
    │
    ├── Online ──────────────────────┐
    │                                │
    ▼                                ▼
┌─────────────────┐         ┌─────────────────┐
│ Load from       │         │ Fetch from      │
│ IndexedDB       │         │ Turso (server)  │
│ (show cached)   │         │                 │
└─────────────────┘         └─────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │ Update          │
                            │ IndexedDB cache │
                            └─────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │ Render fresh    │
                            │ data            │
                            └─────────────────┘
```

### Create/Edit/Delete Operations

```typescript
// Online only - show error if offline
async function createWod(data: WodInput) {
	if (!navigator.onLine) {
		throw new Error('You are offline. Cannot create WoD.');
	}

	// 1. Save to Turso via API
	const wod = await api.post('/api/wods', data);

	// 2. Update local IndexedDB cache
	await idb.put('wods', wod);

	return wod;
}
```

### Offline State Management

```typescript
// src/lib/stores/sync.svelte.ts
import { browser } from '$app/environment';

function createSyncStore() {
	let isOnline = $state(browser ? navigator.onLine : true);

	if (browser) {
		window.addEventListener('online', () => (isOnline = true));
		window.addEventListener('offline', () => (isOnline = false));
	}

	return {
		get isOnline() {
			return isOnline;
		},
		get isOffline() {
			return !isOnline;
		}
	};
}

export const syncStore = createSyncStore();
```

---

## 5. PWA Configuration

### Manifest

```json
// static/manifest.json
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

### Service Worker

```javascript
// static/sw.js
const CACHE_NAME = 'rolimbox-v1';
const STATIC_ASSETS = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener('fetch', (event) => {
	// Cache-first for static assets, network-first for API
	if (event.request.url.includes('/api/')) {
		event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
	} else {
		event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
	}
});
```

### Root Layout PWA Tags

```svelte
<!-- src/routes/+layout.svelte -->
<svelte:head>
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#2D1B4E" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<link rel="apple-touch-icon" href="/icons/icon-192.png" />
</svelte:head>
```

---

## 6. Tailwind Brand Colors

```css
/* src/app.css */
@import 'tailwindcss';

@theme {
	/* Primary - Dark Purple */
	--color-primary-900: #2d1b4e;
	--color-primary-800: #3d2663;
	--color-primary-700: #4a2c6f;
	--color-primary-600: #5c3a87;
	--color-primary-500: #6e489f;

	/* Secondary - Black */
	--color-secondary-900: #0a0a0a;
	--color-secondary-800: #1a1a1a;
	--color-secondary-700: #2a2a2a;

	/* Accent - Pink */
	--color-accent-500: #e91e8c;
	--color-accent-400: #ff6b9d;
	--color-accent-300: #ff8fb3;

	/* Muted - Light Purple */
	--color-muted: #8b7ab8;
}
```

---

## 7. Phase 1 Deliverables Checklist

### PWA Foundation

- [ ] PWA manifest with RolimBox branding
- [ ] Service worker for static asset caching
- [ ] App icons (192px, 512px)
- [ ] Root layout with PWA meta tags
- [ ] Responsive layout shell (mobile-first)

### Authentication System

- [ ] Update user schema (email, password_hash)
- [ ] Password hashing with Argon2
- [ ] Registration flow with workspace creation
- [ ] Login flow
- [ ] Logout flow
- [ ] Protected route middleware
- [ ] Login page UI
- [ ] Register page UI

### Database Schema

- [ ] User table updates
- [ ] Workspace table
- [ ] WorkspaceMember table
- [ ] WoD table
- [ ] Section table
- [ ] Run migrations

### Local Cache Layer

- [ ] IndexedDB setup (idb library)
- [ ] WoD and Section object stores
- [ ] Sync metadata store
- [ ] Cache read/write utilities

### Data Sync

- [ ] Online/offline detection store
- [ ] Fetch WoDs from Turso on load
- [ ] Update IndexedDB after fetch
- [ ] Load from IndexedDB when offline
- [ ] Offline indicator UI component

### Basic UI

- [ ] Tailwind brand color tokens
- [ ] Empty dashboard page
- [ ] Offline banner component

---

## 8. What Phase 1 Does NOT Include

- WoD creation/editing UI (Phase 2)
- Workout library list (Phase 2)
- Timer system (Phase 3)
- Audio cues (Phase 4)
- UI polish and animations (Phase 5)

---

## Document Control

**Version**: 1.0
**Date**: December 22, 2025
**Status**: Approved for Implementation
**Next Step**: Create detailed implementation plan with task breakdown
