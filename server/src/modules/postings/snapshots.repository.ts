import type {
  JobSnapshot,
  PostingDetails,
  PostingRef,
  PostingStatus,
  SnapshotSource,
  SnapshotSummary,
} from '@job-tracker/shared';
import type { Db } from '../../db/pool.js';

interface Row {
  application_id: string;
  source: SnapshotSource;
  posting_board: string | null;
  posting_id: string | null;
  posting_region: 'eu' | null;
  title: string | null;
  company: string | null;
  location: string | null;
  description: string;
  posted_at: Date | null;
  fetched_at: Date;
  posting_status: PostingStatus;
  last_checked_at: Date | null;
  miss_count: number;
  closed_at: Date | null;
}

const t = (d: Date | null) => (d ? d.toISOString() : null);

function toSnapshot(r: Row): JobSnapshot {
  return {
    applicationId: r.application_id,
    source: r.source,
    title: r.title,
    company: r.company,
    location: r.location,
    description: r.description,
    postedAt: t(r.posted_at),
    fetchedAt: r.fetched_at.toISOString(),
    postingStatus: r.posting_status,
    lastCheckedAt: t(r.last_checked_at),
    closedAt: t(r.closed_at),
  };
}

export interface DueCheck {
  applicationId: string;
  ref: PostingRef;
  missCount: number;
}

/** Saved job postings. User-facing queries are scoped by user_id; the checker runs across users. */
export class SnapshotsRepository {
  constructor(private readonly db: Db) {}

  async get(userId: string, applicationId: string): Promise<JobSnapshot | null> {
    const { rows } = await this.db.query<Row>(
      'SELECT * FROM job_snapshots WHERE application_id = $1 AND user_id = $2',
      [applicationId, userId],
    );
    return rows[0] ? toSnapshot(rows[0]) : null;
  }

  async summaries(userId: string): Promise<SnapshotSummary[]> {
    const { rows } = await this.db.query<Row>(
      `SELECT application_id, source, posting_status, fetched_at, last_checked_at, closed_at
         FROM job_snapshots WHERE user_id = $1`,
      [userId],
    );
    return rows.map((r) => ({
      applicationId: r.application_id,
      source: r.source,
      postingStatus: r.posting_status,
      fetchedAt: r.fetched_at.toISOString(),
      lastCheckedAt: t(r.last_checked_at),
      closedAt: t(r.closed_at),
    }));
  }

  /** Save a freshly fetched posting (replaces any earlier copy for this application). */
  async saveFetched(userId: string, applicationId: string, ref: PostingRef, p: PostingDetails): Promise<JobSnapshot> {
    const { rows } = await this.db.query<Row>(
      `INSERT INTO job_snapshots (application_id, user_id, source, posting_board, posting_id, posting_region,
                                  title, company, location, description, posted_at, fetched_at,
                                  posting_status, last_checked_at, miss_count, closed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), 'open', now(), 0, NULL)
       ON CONFLICT (application_id) DO UPDATE SET
         source = EXCLUDED.source, posting_board = EXCLUDED.posting_board, posting_id = EXCLUDED.posting_id,
         posting_region = EXCLUDED.posting_region, title = EXCLUDED.title, company = EXCLUDED.company,
         location = EXCLUDED.location, description = EXCLUDED.description, posted_at = EXCLUDED.posted_at,
         fetched_at = now(), posting_status = 'open', last_checked_at = now(), miss_count = 0, closed_at = NULL
       WHERE job_snapshots.user_id = EXCLUDED.user_id
       RETURNING *`,
      [
        applicationId, userId, ref.source, ref.board, ref.id, ref.region ?? null,
        p.title.slice(0, 300), p.company.slice(0, 300), p.location?.slice(0, 300) ?? null,
        p.description, p.postedAt,
      ],
    );
    return toSnapshot(rows[0]!);
  }

  /** The posting was already gone when we first tried: remember that, keep any earlier text. */
  async saveClosed(userId: string, applicationId: string, ref: PostingRef): Promise<JobSnapshot> {
    const { rows } = await this.db.query<Row>(
      `INSERT INTO job_snapshots (application_id, user_id, source, posting_board, posting_id, posting_region,
                                  posting_status, last_checked_at, miss_count, closed_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'closed', now(), 2, now())
       ON CONFLICT (application_id) DO UPDATE SET
         posting_status = 'closed', last_checked_at = now(), miss_count = 2,
         closed_at = COALESCE(job_snapshots.closed_at, now())
       WHERE job_snapshots.user_id = EXCLUDED.user_id
       RETURNING *`,
      [applicationId, userId, ref.source, ref.board, ref.id, ref.region ?? null],
    );
    return toSnapshot(rows[0]!);
  }

  /** Save a pasted description (for boards we can't fetch). */
  async saveManual(userId: string, applicationId: string, description: string): Promise<JobSnapshot> {
    const { rows } = await this.db.query<Row>(
      `INSERT INTO job_snapshots (application_id, user_id, source, description, fetched_at, posting_status)
       VALUES ($1, $2, 'manual', $3, now(), 'unknown')
       ON CONFLICT (application_id) DO UPDATE SET
         source = 'manual', posting_board = NULL, posting_id = NULL, posting_region = NULL,
         description = EXCLUDED.description, fetched_at = now(), posting_status = 'unknown',
         last_checked_at = NULL, miss_count = 0, closed_at = NULL
       WHERE job_snapshots.user_id = EXCLUDED.user_id
       RETURNING *`,
      [applicationId, userId, description],
    );
    return toSnapshot(rows[0]!);
  }

  async delete(userId: string, applicationId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      'DELETE FROM job_snapshots WHERE application_id = $1 AND user_id = $2',
      [applicationId, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  /**
   * Postings to re-check: fetched (not pasted), not yet closed, application still active,
   * real accounts only (demo sandboxes never trigger outbound requests). Oldest check first.
   */
  async dueForCheck(limit: number): Promise<DueCheck[]> {
    const { rows } = await this.db.query<Row>(
      `SELECT s.*
         FROM job_snapshots s
         JOIN applications a ON a.id = s.application_id
         JOIN users u ON u.id = s.user_id
        WHERE s.source <> 'manual'
          AND s.posting_status <> 'closed'
          AND a.status NOT IN ('offer', 'rejected')
          AND NOT u.is_demo
          AND (s.last_checked_at IS NULL OR s.last_checked_at < now() - interval '20 hours')
        ORDER BY s.last_checked_at NULLS FIRST
        LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      applicationId: r.application_id,
      ref: {
        source: r.source as PostingRef['source'],
        board: r.posting_board!,
        id: r.posting_id!,
        ...(r.posting_region ? { region: r.posting_region } : {}),
      },
      missCount: Number(r.miss_count),
    }));
  }

  /** Record a check result. Two misses in a row marks the posting closed. */
  async recordCheck(applicationId: string, outcome: 'open' | 'missing' | 'error'): Promise<void> {
    if (outcome === 'open') {
      await this.db.query(
        `UPDATE job_snapshots SET posting_status = 'open', miss_count = 0, last_checked_at = now()
          WHERE application_id = $1`,
        [applicationId],
      );
    } else if (outcome === 'missing') {
      await this.db.query(
        `UPDATE job_snapshots
            SET miss_count = miss_count + 1,
                posting_status = CASE WHEN miss_count + 1 >= 2 THEN 'closed' ELSE posting_status END,
                closed_at = CASE WHEN miss_count + 1 >= 2 THEN now() ELSE closed_at END,
                last_checked_at = now()
          WHERE application_id = $1`,
        [applicationId],
      );
    } else {
      // Network trouble isn't evidence either way; just move it to the back of the queue.
      await this.db.query('UPDATE job_snapshots SET last_checked_at = now() WHERE application_id = $1', [
        applicationId,
      ]);
    }
  }
}
