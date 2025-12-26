# Multi-User Workspace Design

## Overview

Enable multiple users to share a workspace, allowing coaches to invite athletes and other coaches to view and collaborate on workouts.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Invitation method | Invite link/code (no email required) |
| Personal workspace for invited users | No - they only belong to the workspace they joined |
| Code format & expiration | Short readable codes (e.g., `COACH-7K2M`), 7-day expiration |
| Role assignment | Owner chooses role when generating invite (coach or member) |
| Existing user join flow | `/join/CODE` URL with confirmation modal |
| Multiple workspaces | Allowed - users can belong to several, one "active" at a time via localStorage |

## User Flows

### Flow A: Owner Creates Invite
1. Owner goes to Settings → Workspace → "Invite Members"
2. Selects role: "Coach" or "Member"
3. Clicks "Generate Invite Link"
4. System creates invite code, expires in 7 days
5. Shows copyable link: `yourapp.com/join/COACH-7K2M`
6. Owner shares link via WhatsApp, text, verbally, etc.

### Flow B: New User Joins via Invite
1. Clicks invite link → lands on `/join/COACH-7K2M`
2. Page shows: "You've been invited to join [Workspace Name] as [role]"
3. Since not logged in → shows registration form (email + password)
4. On submit: creates user, skips personal workspace creation, adds to invited workspace
5. Redirects to app, now seeing the shared workspace

### Flow C: Existing User Joins via Invite
1. Clicks invite link while logged in → lands on `/join/COACH-7K2M`
2. Page shows: "Join [Workspace Name] as [role]?"
3. Clicks "Join" → added to workspace, becomes active workspace
4. Redirects to app showing the new workspace
5. Previous workspace(s) still accessible via switcher

### Flow D: Owner Manages Invites
1. Settings → Workspace shows active invite codes
2. Can revoke (delete) any code before expiration
3. Shows list of current members with roles

### Flow E: Switching Workspaces
1. User clicks workspace name in header → dropdown shows all their workspaces
2. Selects different workspace → stored in localStorage as active
3. Page refreshes WoD list for the new active workspace

## Database Changes

### New Table: `workspace_invite`

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (PK) | Unique ID |
| `code` | text (unique) | The invite code, e.g., `COACH-7K2M` |
| `workspaceId` | text (FK) | Which workspace this invites to |
| `role` | text | `coach` or `member` |
| `createdAt` | timestamp | When created |
| `expiresAt` | timestamp | 7 days after creation |
| `createdBy` | text (FK) | User who created the invite |

### Schema Update
- Add `member` as valid role in `workspaceMember.role` (currently only `owner` and `coach`)

## API Endpoints

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/workspaces` | GET | List all workspaces user belongs to | Required |
| `/api/workspaces/[id]/invites` | POST | Create invite code (owner only) | Required |
| `/api/workspaces/[id]/invites` | GET | List active invites (owner only) | Required |
| `/api/workspaces/[id]/invites/[code]` | DELETE | Revoke an invite (owner only) | Required |
| `/api/workspaces/[id]/members` | GET | List workspace members | Required |
| `/api/workspaces/[id]/members/[userId]` | DELETE | Remove member (owner only) | Required |
| `/api/invites/[code]` | GET | Get invite details (public - for join page) | None |
| `/api/invites/[code]/accept` | POST | Accept invite (adds user to workspace) | Required |

## Auth Functions

### New Functions (`src/lib/server/auth.ts`)
- `getUserWorkspaces(userId)` → Returns all workspaces for user
- `addUserToWorkspace(userId, workspaceId, role)` → Creates workspaceMember record
- `isWorkspaceOwner(userId, workspaceId)` → Checks if user is owner

### Modified Functions
- `createWorkspaceForUser(userId)` → Make optional (skip for invited users)

### Modified Registration (`/register`)
- Accept optional `inviteCode` query param
- If present: validate code, create user, add to workspace, skip personal workspace creation

## Frontend Components

### New Pages

| Route | Purpose |
|-------|---------|
| `/join/[code]` | Join workspace page - shows invite details, registration form or confirm button |
| `/settings/workspace` | Workspace settings - manage invites, view members |

### New Components

| Component | Purpose |
|-----------|---------|
| `WorkspaceSwitcher.svelte` | Header dropdown for switching workspaces |
| `InviteManager.svelte` | Generate invites, list active codes, revoke |
| `MemberList.svelte` | Show members with roles, remove button for owners |
| `JoinForm.svelte` | Registration form with invite context |

### Modified Components
- `Header.svelte` or `+layout.svelte` → Add WorkspaceSwitcher
- `+layout.server.ts` → Load all user workspaces, not just one

### Client-Side State
- `localStorage.getItem('activeWorkspaceId')` tracks current workspace
- On workspace switch: update localStorage, reload WoDs
- On first load: if no active workspace set, use first one from list

## Error Handling

### Invite Validation Errors

| Scenario | Behavior |
|----------|----------|
| Code doesn't exist | Show "Invalid invite code" |
| Code expired | Show "This invite has expired. Ask for a new one." |
| User already in workspace | Show "You're already a member" with link |
| Workspace deleted | Show "This workspace no longer exists" |

### Permission Errors

| Scenario | Behavior |
|----------|----------|
| Non-owner tries to create invite | 403 Forbidden |
| Non-owner tries to remove member | 403 Forbidden |
| Member tries to access owner-only settings | Hide UI elements |

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Owner leaves workspace | Block if sole owner - must transfer ownership or delete |
| Last member leaves | Workspace remains orphaned |
| User's only workspace and they leave | Show "Create or join a workspace" prompt |
| Active workspace deleted | Switch to first available or show prompt |

## Testing Checklist

### Automated Tests
- [ ] Owner can create invite; non-owner cannot
- [ ] Valid code works; expired/non-existent rejected
- [ ] Registration with invite skips personal workspace
- [ ] Existing user join preserves other workspaces
- [ ] Workspace switching updates localStorage and reloads WoDs
- [ ] Members can view but not edit; coaches can edit; owners manage
- [ ] Owner cannot leave if sole owner

### Manual Tests
1. Create invite as owner, copy link
2. Open incognito, paste link, register → lands in workspace
3. Generate another invite, log in as existing user, paste link → joins
4. Switch between workspaces, verify correct WoDs load
5. Remove a member, verify they lose access
