import type {
  PlanKey,
  ProblemProgress,
  StudyPace,
  StudyPlan,
  StudyPlanState,
} from '@job-tracker/shared';
import type { Db } from '../../db/pool.js';

interface PlanRow {
  plan_key: PlanKey;
  pace: StudyPace;
  study_days: number[];
  start_date: string;
  created_at: Date;
  updated_at: Date;
}

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

/** Study plans and solved-problem progress. Every query is scoped by user_id. */
export class StudyPlansRepository {
  constructor(private readonly db: Db) {}

  async state(userId: string, planKey: PlanKey): Promise<StudyPlanState> {
    const [plan, progress] = await Promise.all([
      this.db.query<PlanRow>('SELECT * FROM study_plans WHERE user_id = $1 AND plan_key = $2', [
        userId,
        planKey,
      ]),
      this.db.query<{ slug: string; solved_on: string }>(
        'SELECT slug, solved_on FROM problem_progress WHERE user_id = $1 ORDER BY solved_at',
        [userId],
      ),
    ]);
    return {
      plan: plan.rows[0] ? toPlan(plan.rows[0]) : null,
      progress: progress.rows.map((r): ProblemProgress => ({ slug: r.slug, solvedOn: r.solved_on })),
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

  /** Mark solved. Re-marking keeps the original date. */
  async markSolved(userId: string, slug: string, solvedOn: string): Promise<ProblemProgress> {
    const { rows } = await this.db.query<{ slug: string; solved_on: string }>(
      `INSERT INTO problem_progress (user_id, slug, solved_on) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, slug) DO UPDATE SET slug = problem_progress.slug
       RETURNING slug, solved_on`,
      [userId, slug, solvedOn],
    );
    return { slug: rows[0]!.slug, solvedOn: rows[0]!.solved_on };
  }

  async markUnsolved(userId: string, slug: string): Promise<void> {
    await this.db.query('DELETE FROM problem_progress WHERE user_id = $1 AND slug = $2', [
      userId,
      slug,
    ]);
  }
}
