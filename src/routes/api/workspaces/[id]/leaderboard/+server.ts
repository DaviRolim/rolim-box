import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { workspaceMember, user, personalRecord, exercise } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type {
	LeaderboardResponse,
	LeaderboardUser,
	ExerciseLeader,
	MeasurementType,
	ExerciseCategory
} from '$lib/types/pr';

/**
 * GET /api/workspaces/[id]/leaderboard
 * Returns workspace leaderboard with points and exercise leaders
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: workspaceId } = params;

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

		// Get all workspace members and exercises in parallel
		const [members, exercises] = await Promise.all([
			db
				.select({
					userId: workspaceMember.userId,
					email: user.email
				})
				.from(workspaceMember)
				.innerJoin(user, eq(workspaceMember.userId, user.id))
				.where(eq(workspaceMember.workspaceId, workspaceId)),
			db.select().from(exercise)
		]);

		const memberIds = members.map((m) => m.userId);
		const memberMap = new Map(members.map((m) => [m.userId, m.email]));

		// Create exercise lookup map once
		const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

		// Get all PRs for workspace members
		const allPRs =
			memberIds.length > 0
				? await db
						.select()
						.from(personalRecord)
						.where(inArray(personalRecord.userId, memberIds))
				: [];

		// Calculate best PR per user per exercise
		const bestPRs = new Map<string, Map<string, { value: number; date: string }>>();

		for (const pr of allPRs) {
			const ex = exerciseMap.get(pr.exerciseId);
			if (!ex) continue;

			if (!bestPRs.has(pr.exerciseId)) {
				bestPRs.set(pr.exerciseId, new Map());
			}

			const exercisePRs = bestPRs.get(pr.exerciseId)!;
			const existing = exercisePRs.get(pr.userId);

			const isBetter =
				!existing ||
				(ex.measurementType === 'time' ? pr.value < existing.value : pr.value > existing.value);

			if (isBetter) {
				exercisePRs.set(pr.userId, { value: pr.value, date: pr.date });
			}
		}

		// Calculate points per user and track exercise leaders
		const pointsMap = new Map<string, number>();
		const exerciseLeaders: ExerciseLeader[] = [];

		// Initialize all members with 0 points
		for (const userId of memberIds) {
			pointsMap.set(userId, 0);
		}

		// For each exercise, find the leader(s)
		for (const ex of exercises) {
			const exercisePRs = bestPRs.get(ex.id);

			const leaders: ExerciseLeader['leaders'] = [];

			if (exercisePRs && exercisePRs.size > 0) {
				// Find the best value for this exercise
				let bestValue: number | null = null;

				for (const [userId, pr] of exercisePRs) {
					if (bestValue === null) {
						bestValue = pr.value;
					} else if (ex.measurementType === 'time') {
						bestValue = Math.min(bestValue, pr.value);
					} else {
						bestValue = Math.max(bestValue, pr.value);
					}
				}

				// Award points to everyone with the best value (ties)
				for (const [userId, pr] of exercisePRs) {
					if (pr.value === bestValue) {
						pointsMap.set(userId, (pointsMap.get(userId) || 0) + 1);
						leaders.push({
							userId,
							email: memberMap.get(userId) || '',
							value: pr.value,
							date: pr.date
						});
					}
				}
			}

			exerciseLeaders.push({
				exerciseId: ex.id,
				exerciseName: ex.name,
				category: ex.category as ExerciseCategory,
				measurementType: ex.measurementType as MeasurementType,
				leaders
			});
		}

		// Sort users by points (descending), then by email for stable ordering
		const rankings: LeaderboardUser[] = members
			.map((m) => ({
				userId: m.userId,
				email: m.email,
				points: pointsMap.get(m.userId) || 0,
				rank: 0
			}))
			.sort((a, b) => {
				if (b.points !== a.points) return b.points - a.points;
				return a.email.localeCompare(b.email);
			});

		// Assign ranks (same rank for ties)
		let currentRank = 1;
		for (let i = 0; i < rankings.length; i++) {
			if (i > 0 && rankings[i].points < rankings[i - 1].points) {
				currentRank = i + 1;
			}
			rankings[i].rank = currentRank;
		}

		// Count active exercises (exercises with at least one PR)
		const activeExercises = exerciseLeaders.filter((e) => e.leaders.length > 0).length;

		const response: LeaderboardResponse = {
			rankings,
			exerciseLeaders,
			totalExercises: exercises.length,
			activeExercises,
			currentUserId: locals.user.id
		};

		return json(response);
	} catch (error) {
		console.error('Leaderboard API error:', error);
		return json({ error: 'Failed to load leaderboard' }, { status: 500 });
	}
};
