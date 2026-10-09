import type {
  ActivityDay,
  PlanKey,
  PrepGoals,
  PrepGoalsInput,
  ProblemProgress,
  ReviewRating,
  ReviewState,
  StudyPace,
  StudyPlan,
  StudyPlanState,
} from '@job-tracker/shared';
import { DEFAULT_GOALS } from '@job-tracker/shared';
import type { Db } from '../../db/pool.js';

interface PlanRow {
  plan_key: PlanKey;
  pace: StudyPace;
  study_days: number[];
  start_date: string;
  created_at: Date;
  updated_at: Date;
}

interface ProgressRow {
  slug: string;
  solved_on: string;
  rating: ReviewRating | null;
  review_stage: number;
  next_review_on: string | null;
  last_reviewed_on: string | null;
  review_count: number;
}

const PROGRESS_COLUMNS =
  'slug, solved_on, rating, review_stage, next_review_on, last_reviewed_on, review_count';

function toPlan(row: PlanRow): StudyPlan {
  return {
    planKey: row.plan_key,
    pace: row.pace,
    studyDays: row.study_days.map(Number),
    startDate: row.start_date,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toProgress(r: ProgressRow): ProblemProgress {
  return {
    slug: r.slug,
    solvedOn: r.solved_on,
    rating: r.rating,
    reviewStage: Number(r.review_stage),
    nextReviewOn: r.next_review_on,
    lastReviewedOn: r.last_reviewed_on,
    reviewCount: Number(r.review_count),
  };
}

/** Study plans, solved-problem progress, reviews and goals. Every query is scoped by user_id. */
export class StudyPlansRepository {
  constructor(private readonly db: Db) {}

  async state(userId: string, planKey: PlanKey): Promise<StudyPlanState> {
    const [plan, progress] = await Promise.all([
      this.db.query<PlanRow>('SELECT * FROM study_plans WHERE user_id = $1 AND plan_key = $2', [
        userId,
        planKey,
      ]),
      this.db.query<ProgressRow>(
        `SELECT ${PROGRESS_COLUMNS} FROM problem_progress WHERE user_id = $1 ORDER BY solved_at`,
        [userId],
      ),
    ]);
    return {
      plan: plan.rows[0] ? toPlan(plan.rows[0]) : null,
      progress: progress.rows.map(toProgress),
    };
  }

  async upsertPlan(
    userId: string,
    planKey: PlanKey,
    input: { pace: StudyPace; studyDays: number[]; startDate: string },
  ): Promise<StudyPlan> {
    const { rows } = await this.db.query<PlanRow>(
      `INSERT INTO study_plans (user_id, plan_key, pace, study_days, start_date)
       VALUES ($1, $2, $3, $4::smallint[], $5)
       ON CONFLICT (user_id, plan_key) DO UPDATE
         SET pace = EXCLUDED.pace, study_days = EXCLUDED.study_days, start_date = EXCLUDED.start_date
       RETURNING *`,
      [userId, planKey, input.pace, input.studyDays, input.startDate],
    );
    return toPlan(rows[0]!);
  }

  async deletePlan(userId: string, planKey: PlanKey): Promise<boolean> {
    const { rowCount } = await this.db.query(
      'DELETE FROM study_plans WHERE user_id = $1 AND plan_key = $2',
      [userId, planKey],
    );
    return (rowCount ?? 0) > 0;
  }

  async findProgress(userId: string, slug: string): Promise<ProblemProgress | null> {
    const { rows } = await this.db.query<ProgressRow>(
      `SELECT ${PROGRESS_COLUMNS} FROM problem_progress WHERE user_id = $1 AND slug = $2`,
      [userId, slug],
    );
    return rows[0] ? toProgress(rows[0]) : null;
  }

  /** Insert a solved problem. If it already exists, the existing row is returned unchanged. */
  async insertSolved(
    userId: string,
    slug: string,
    solvedOn: string,
    rating: ReviewRating,
    review: ReviewState,
  ): Promise<ProblemProgress> {
    const { rows } = await this.db.query<ProgressRow>(
      `INSERT INTO problem_progress (user_id, slug, solved_on, rating, review_stage, next_review_on)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, slug) DO UPDATE SET slug = problem_progress.slug
       RETURNING ${PROGRESS_COLUMNS}`,
      [userId, slug, solvedOn, rating, review.stage, review.nextReviewOn],
    );
    return toProgress(rows[0]!);
  }

  /** Change the rating of a problem that hasn't been reviewed yet (re-plans its first review). */
  async rerate(userId: string, slug: string, rating: ReviewRating, review: ReviewState) {
    const { rows } = await this.db.query<ProgressRow>(
      `UPDATE problem_progress SET rating = $3, review_stage = $4, next_review_on = $5
        WHERE user_id = $1 AND slug = $2 AND review_count = 0
        RETURNING ${PROGRESS_COLUMNS}`,
      [userId, slug, rating, review.stage, review.nextReviewOn],
    );
    return rows[0] ? toProgress(rows[0]) : null;
  }

  /** Forget every solved problem and review (the "start over" option when stopping a plan). */
  async clearProgress(userId: string): Promise<{ problems: number; reviews: number }> {
    const { rows } = await this.db.query<{ problems: number; reviews: number }>(
      `WITH p AS (DELETE FROM problem_progress WHERE user_id = $1 RETURNING 1),
            r AS (DELETE FROM problem_reviews WHERE user_id = $1 RETURNING 1)
       SELECT (SELECT count(*) FROM p)::int AS problems, (SELECT count(*) FROM r)::int AS reviews`,
      [userId],
    );
    return rows[0]!;
  }

  async markUnsolved(userId: string, slug: string): Promise<void> {
    await this.db.query('DELETE FROM problem_progress WHERE user_id = $1 AND slug = $2', [
      userId,
      slug,
    ]);
  }

  /** Record a review and move the schedule along — one atomic statement. */
  async recordReview(
    userId: string,
    slug: string,
    rating: ReviewRating,
    reviewedOn: string,
    next: ReviewState,
  ): Promise<ProblemProgress | null> {
    const { rows } = await this.db.query<ProgressRow>(
      `WITH updated AS (
         UPDATE problem_progress
            SET review_stage = $5, next_review_on = $6, last_reviewed_on = $4,
                review_count = review_count + 1
          WHERE user_id = $1 AND slug = $2
          RETURNING ${PROGRESS_COLUMNS}
       ), logged AS (
         INSERT INTO problem_reviews (user_id, slug, reviewed_on, rating)
         SELECT $1, slug, $4, $3 FROM updated
       )
       SELECT * FROM updated`,
      [userId, slug, rating, reviewedOn, next.stage, next.nextReviewOn],
    );
    return rows[0] ? toProgress(rows[0]) : null;
  }

  /** Solves and reviews per day, for the heatmap and streaks. Days without activity are omitted. */
  async activity(userId: string, from: string, to: string): Promise<ActivityDay[]> {
    const { rows } = await this.db.query<{ day: string; solves: number; reviews: number }>(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, sum(solves)::int AS solves, sum(reviews)::int AS reviews
         FROM (
           SELECT solved_on AS day, 1 AS solves, 0 AS reviews
             FROM problem_progress WHERE user_id = $1 AND solved_on BETWEEN $2 AND $3
           UNION ALL
           SELECT reviewed_on, 0, 1
             FROM problem_reviews WHERE user_id = $1 AND reviewed_on BETWEEN $2 AND $3
         ) AS events
        GROUP BY day
        ORDER BY day`,
      [userId, from, to],
    );
    return rows;
  }

  async goals(userId: string): Promise<PrepGoals> {
    const { rows } = await this.db.query<{
      target_date: string;
      weekly_problems: number;
      weekly_applications: number;
      weekly_referrals: number;
    }>('SELECT target_date, weekly_problems, weekly_applications, weekly_referrals FROM prep_goals WHERE user_id = $1', [
      userId,
    ]);
    const r = rows[0];
    if (!r) return { ...DEFAULT_GOALS, isDefault: true };
    return {
      targetDate: r.target_date,
      weeklyProblems: Number(r.weekly_problems),
      weeklyApplications: Number(r.weekly_applications),
      weeklyReferrals: Number(r.weekly_referrals),
      isDefault: false,
    };
  }

  async saveGoals(userId: string, g: Required<PrepGoalsInput>): Promise<PrepGoals> {
    await this.db.query(
      `INSERT INTO prep_goals (user_id, target_date, weekly_problems, weekly_applications, weekly_referrals)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE
         SET target_date = EXCLUDED.target_date,
             weekly_problems = EXCLUDED.weekly_problems,
             weekly_applications = EXCLUDED.weekly_applications,
             weekly_referrals = EXCLUDED.weekly_referrals`,
      [userId, g.targetDate, g.weeklyProblems, g.weeklyApplications, g.weeklyReferrals],
    );
    return this.goals(userId);
  }
}
