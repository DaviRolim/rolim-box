import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workspaceMember, user, personalRecord, exercise } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type {
	ExerciseRankingsResponse,
	ExerciseRanking,
	ExerciseCategory,
	MeasurementType
} from '$lib/types/pr';

/**
 * GET /api/workspaces/[id]/exercises/[exerciseId]/rankings
 * Returns rankings for a specific exercise within a workspace
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: workspaceId, exerciseId } = params;

		// Check if user is a member of this workspace
		const [membership] = await db
			.select()
			.from(workspaceMember)
			.where(
				and(eq(workspaceMember.userId, locals.user.id), eq(workspaceMember.workspaceId, workspaceId))
			);

		if (!membership) {
			return json({ error: 'Not a member of this workspace' }, { status: 403 });
		}

		// Get the exercise
		const [ex] = await db.select().from(exercise).where(eq(exercise.id, exerciseId));

		if (!ex) {
			return json({ error: 'Exercise not found' }, { status: 404 });
		}

		// Get all workspace members
		const members = await db
			.select({
				userId: workspaceMember.userId,
				email: user.email
			})
			.from(workspaceMember)
			.innerJoin(user, eq(workspaceMember.userId, user.id))
			.where(eq(workspaceMember.workspaceId, workspaceId));

		const memberIds = members.map((m) => m.userId);
		const memberMap = new Map(members.map((m) => [m.userId, m.email]));

		// Get all PRs for this exercise from workspace members
		const prs =
			memberIds.length > 0
				? await db
						.select()
						.from(personalRecord)
						.where(
							and(
								eq(personalRecord.exerciseId, exerciseId),
								inArray(personalRecord.userId, memberIds)
							)
						)
				: [];

		// Find best PR per user
		const bestPRs = new Map<string, { value: number; date: string }>();

		for (const pr of prs) {
			const existing = bestPRs.get(pr.userId);
			const isBetter =
				!existing ||
				(ex.measurementType === 'time' ? pr.value < existing.value : pr.value > existing.value);

			if (isBetter) {
				bestPRs.set(pr.userId, { value: pr.value, date: pr.date });
			}
		}

		// Create rankings array
		const rankings: ExerciseRanking[] = [];

		for (const [userId, pr] of bestPRs) {
			rankings.push({
				rank: 0,
				userId,
				email: memberMap.get(userId) || '',
				value: pr.value,
				date: pr.date
			});
		}

		// Sort by value (ascending for time, descending for others)
		rankings.sort((a, b) => {
			if (ex.measurementType === 'time') {
				return a.value - b.value;
			}
			return b.value - a.value;
		});

		// Assign ranks (same rank for ties)
		let currentRank = 1;
		for (let i = 0; i < rankings.length; i++) {
			if (i > 0 && rankings[i].value !== rankings[i - 1].value) {
				currentRank = i + 1;
			}
			rankings[i].rank = currentRank;
		}

		const response: ExerciseRankingsResponse = {
			exercise: {
				id: ex.id,
				name: ex.name,
				category: ex.category as ExerciseCategory,
				measurementType: ex.measurementType as MeasurementType
			},
			rankings,
			totalMembers: members.length,
			membersWithPR: bestPRs.size,
			currentUserId: locals.user.id
		};

		return json(response);
	} catch (error) {
		console.error('Exercise rankings API error:', error);
		return json({ error: 'Failed to load exercise rankings' }, { status: 500 });
	}
};
