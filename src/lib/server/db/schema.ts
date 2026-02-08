import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// User account
export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	unitPreference: text('unit_preference').notNull().default('metric') // 'metric' | 'imperial'
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
export const wod = sqliteTable(
	'wod',
	{
		id: text('id').primaryKey(),
		workspaceId: text('workspace_id')
			.notNull()
			.references(() => workspace.id),
		date: text('date').notNull(), // ISO date: "2025-12-22"
		description: text('description'),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [index('wod_workspace_id_idx').on(table.workspaceId)]
);

// WoD Sections
export const section = sqliteTable(
	'section',
	{
		id: text('id').primaryKey(),
		wodId: text('wod_id')
			.notNull()
			.references(() => wod.id, { onDelete: 'cascade' }),
		type: text('type').notNull(), // 'warmup'|'skill'|'wod'|'cooldown'|'stretches'|'custom'
		name: text('name').notNull(),
		content: text('content').notNull().default(''),
		order: integer('order').notNull(),
		timerConfig: text('timer_config') // nullable, JSON string
	},
	(table) => [index('section_wod_id_idx').on(table.wodId)]
);

// Exercise (predefined, seeded)
export const exercise = sqliteTable('exercise', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	category: text('category').notNull(), // 'weightlifting' | 'benchmark' | 'gymnastics' | 'cardio'
	measurementType: text('measurement_type').notNull(), // 'weight' | 'time' | 'reps' | 'distance'
	sortOrder: integer('sort_order').notNull()
});

// Personal Record
export const personalRecord = sqliteTable(
	'personal_record',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		exerciseId: text('exercise_id')
			.notNull()
			.references(() => exercise.id, { onDelete: 'cascade' }),
		value: integer('value').notNull(), // stored in base units: grams, seconds, count, centimeters
		note: text('note'),
		date: text('date').notNull(), // ISO date: "2025-12-27"
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('pr_user_id_idx').on(table.userId),
		index('pr_user_exercise_idx').on(table.userId, table.exerciseId)
	]
);

// Type exports
export type Session = typeof session.$inferSelect;
export type User = typeof user.$inferSelect;
export type Workspace = typeof workspace.$inferSelect;
export type WorkspaceMember = typeof workspaceMember.$inferSelect;
export type WorkspaceInvite = typeof workspaceInvite.$inferSelect;
export type Wod = typeof wod.$inferSelect;
export type Section = typeof section.$inferSelect;
export type Exercise = typeof exercise.$inferSelect;
export type PersonalRecord = typeof personalRecord.$inferSelect;
