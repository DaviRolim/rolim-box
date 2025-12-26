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
		role: text('role').notNull(), // 'owner' | 'coach' | 'member'
		joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.userId, table.workspaceId] })]
);

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
export type WorkspaceInvite = typeof workspaceInvite.$inferSelect;
export type Wod = typeof wod.$inferSelect;
export type Section = typeof section.$inferSelect;
