import {
  APPLICATION_STATUSES,
  CLOSED_STATUSES,
  type Application,
  type ApplicationStats,
  type ApplicationStatus,
  type CreateApplication,
  type ListApplicationsQuery,
  type SortField,
  type UpdateApplication,
} from '@job-tracker/shared';
import type { Db } from '../../db/pool.js';

/** Row shape as stored in Postgres. */
interface ApplicationRow {
  id: string;
  company: string;
  role: string;
  link: string | null;
  status: ApplicationStatus;
  applied_date: string | null;
  follow_up_date: string | null;
  notes: string;
  referral_name: string | null;
  referral_status: Application['referralStatus'];
  created_at: Date;
  updated_at: Date;
}

/** API field → column. Also the whitelist for sortable / writable fields (never interpolate user input). */
const COLUMNS = {
  company: 'company',
  role: 'role',
  link: 'link',
  status: 'status',
  appliedDate: 'applied_date',
  followUpDate: 'follow_up_date',
  notes: 'notes',
  referralName: 'referral_name',
  referralStatus: 'referral_status',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const satisfies Record<keyof Omit<Application, 'id'>, string>;

type WritableField = keyof CreateApplication;

// Sort by pipeline order rather than alphabetically.
const STATUS_ORDER_SQL = `array_position(ARRAY[${APPLICATION_STATUSES.map((s) => `'${s}'`).join(',')}]::text[], status)`;
const CLOSED_SQL = CLOSED_STATUSES.map((s) => `'${s}'`).join(',');

function toApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    link: row.link,
    status: row.status,
    appliedDate: row.applied_date,
    followUpDate: row.follow_up_date,
    notes: row.notes,
    referralName: row.referral_name,
    referralStatus: row.referral_status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function sortExpression(field: SortField): string {
  return field === 'status' ? STATUS_ORDER_SQL : COLUMNS[field];
}

/**
 * Data access for applications. All SQL lives here; everything is parameterized.
 * Every query is scoped by `user_id`, so one user can never read or modify another's rows —
 * a row owned by someone else is indistinguishable from one that doesn't exist.
 */
export class ApplicationsRepository {
  constructor(private readonly db: Db) {}

  async list(
    userId: string,
    query: ListApplicationsQuery & { today: string },
  ): Promise<Application[]> {
    const params: unknown[] = [];
    const param = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    const where: string[] = [`user_id = ${param(userId)}`];

    if (query.status) where.push(`status = ${param(query.status)}`);
    if (query.q) {
      const like = param(`%${query.q.replace(/[\\%_]/g, '\\$&')}%`);
      where.push(`(company ILIKE ${like} OR role ILIKE ${like} OR referral_name ILIKE ${like})`);
    }
    if (query.overdue) {
      where.push(`follow_up_date < ${param(query.today)}::date AND status NOT IN (${CLOSED_SQL})`);
    }

    const direction = query.order === 'asc' ? 'ASC' : 'DESC';
    const sql = `
      SELECT * FROM applications
      WHERE ${where.join(' AND ')}
      ORDER BY ${sortExpression(query.sort)} ${direction} NULLS LAST, created_at DESC
    `;
    const { rows } = await this.db.query<ApplicationRow>(sql, params);
    return rows.map(toApplication);
  }

  async findById(userId: string, id: string): Promise<Application | null> {
    const { rows } = await this.db.query<ApplicationRow>(
      'SELECT * FROM applications WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return rows[0] ? toApplication(rows[0]) : null;
  }

  async create(userId: string, input: CreateApplication): Promise<Application> {
    const fields = Object.keys(input) as WritableField[];
    const columns = ['user_id', ...fields.map((f) => COLUMNS[f])];
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    const { rows } = await this.db.query<ApplicationRow>(
      `INSERT INTO applications (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      [userId, ...fields.map((f) => input[f])],
    );
    return toApplication(rows[0]!);
  }

  async update(userId: string, id: string, patch: UpdateApplication): Promise<Application | null> {
    const fields = (Object.keys(patch) as WritableField[]).filter((f) => patch[f] !== undefined);
    if (fields.length === 0) return this.findById(userId, id);

    const assignments = fields.map((f, i) => `${COLUMNS[f]} = $${i + 3}`);
    const { rows } = await this.db.query<ApplicationRow>(
      `UPDATE applications SET ${assignments.join(', ')}
        WHERE id = $1 AND user_id = $2
        RETURNING *`,
      [id, userId, ...fields.map((f) => patch[f])],
    );
    return rows[0] ? toApplication(rows[0]) : null;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      'DELETE FROM applications WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  async stats(userId: string, today: string): Promise<ApplicationStats> {
    const { rows } = await this.db.query<{
      status: ApplicationStatus;
      count: string;
      overdue: string;
    }>(
      `SELECT status,
              count(*) AS count,
              count(*) FILTER (
                WHERE follow_up_date < $1::date AND status NOT IN (${CLOSED_SQL})
              ) AS overdue
         FROM applications
        WHERE user_id = $2
        GROUP BY status`,
      [today, userId],
    );

    const byStatus = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<
      ApplicationStatus,
      number
    >;
    let total = 0;
    let overdueFollowUps = 0;
    for (const row of rows) {
      byStatus[row.status] = Number(row.count);
      total += Number(row.count);
      overdueFollowUps += Number(row.overdue);
    }
    return { total, byStatus, overdueFollowUps };
  }
}
