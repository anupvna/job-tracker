import {
  parsePostingUrl,
  type JobSnapshot,
  type PostingLookupResult,
} from '@job-tracker/shared';
import { HttpError } from '../../lib/httpError.js';
import type { ApplicationsRepository } from '../applications/applications.repository.js';
import { fetchPosting, PostingFetchError, type Fetcher } from './providers.js';
import type { SnapshotsRepository } from './snapshots.repository.js';

export interface CheckSummary {
  checked: number;
  stillOpen: number;
  missing: number;
  errors: number;
}

function upstream(err: unknown): never {
  if (err instanceof PostingFetchError) throw new HttpError(502, 'POSTING_UNAVAILABLE', err.message);
  throw err;
}

/** Saving job postings and noticing when they're taken down. */
export class SnapshotsService {
  constructor(
    private readonly repo: SnapshotsRepository,
    private readonly applications: ApplicationsRepository,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  /** Read a posting for the "Autofill from link" button. Nothing is saved. */
  async lookup(url: string): Promise<PostingLookupResult> {
    const ref = parsePostingUrl(url);
    if (!ref) return { supported: false };
    const result = await fetchPosting(ref, this.fetcher).catch(upstream);
    return result.status === 'open'
      ? { supported: true, status: 'open', posting: result.posting }
      : { supported: true, status: 'closed', source: ref.source };
  }

  get(userId: string, applicationId: string) {
    return this.repo.get(userId, applicationId);
  }

  summaries(userId: string) {
    return this.repo.summaries(userId);
  }

  /** Fetch the application's posting from its link and save a copy. */
  async saveFromLink(userId: string, applicationId: string): Promise<JobSnapshot> {
    const app = await this.applications.findById(userId, applicationId);
    if (!app) throw HttpError.notFound('Application not found');
    const ref = parsePostingUrl(app.link);
    if (!ref) {
      throw new HttpError(
        422,
        'UNSUPPORTED_LINK',
        'Automatic saving works for Greenhouse, Lever and Ashby links. Paste the description instead.',
      );
    }
    const result = await fetchPosting(ref, this.fetcher).catch(upstream);
    return result.status === 'open'
      ? this.repo.saveFetched(userId, applicationId, ref, result.posting)
      : this.repo.saveClosed(userId, applicationId, ref);
  }

  /**
   * Save copies for existing applications that have a supported link but no saved posting yet.
   * Done in small batches so one request stays fast; call again while `remaining` > 0.
   */
  async backfill(userId: string, batch = 12) {
    const [apps, existing] = await Promise.all([
      this.applications.list(userId, { sort: 'createdAt', order: 'desc', today: new Date().toISOString().slice(0, 10) }),
      this.repo.summaries(userId),
    ]);
    const have = new Set(existing.map((s) => s.applicationId));
    const todo = apps
      .map((a) => ({ app: a, ref: parsePostingUrl(a.link) }))
      .filter((x): x is { app: typeof x.app; ref: NonNullable<typeof x.ref> } => x.ref !== null && !have.has(x.app.id));
    const result = { saved: 0, closed: 0, failed: 0, remaining: Math.max(0, todo.length - batch) };
    let next = 0;
    const work = todo.slice(0, batch);
    const worker = async () => {
      while (next < work.length) {
        const { app, ref } = work[next++]!;
        try {
          const r = await fetchPosting(ref, this.fetcher);
          if (r.status === 'open') {
            await this.repo.saveFetched(userId, app.id, ref, r.posting);
            result.saved++;
          } else {
            await this.repo.saveClosed(userId, app.id, ref);
            result.closed++;
          }
        } catch {
          result.failed++;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, work.length) }, worker));
    return result;
  }

  async saveManual(userId: string, applicationId: string, description: string): Promise<JobSnapshot> {
    const app = await this.applications.findById(userId, applicationId);
    if (!app) throw HttpError.notFound('Application not found');
    return this.repo.saveManual(userId, applicationId, description);
  }

  async remove(userId: string, applicationId: string) {
    if (!(await this.repo.delete(userId, applicationId))) throw HttpError.notFound('No saved posting');
  }

  /**
   * Daily job: re-check saved postings, a few at a time, within a time budget so it fits in a
   * serverless function. A posting must be missing on two separate days before it's "closed".
   */
  async checkDue({ limit = 30, concurrency = 6, budgetMs = 20_000 } = {}): Promise<CheckSummary> {
    const due = await this.repo.dueForCheck(limit);
    const summary: CheckSummary = { checked: 0, stillOpen: 0, missing: 0, errors: 0 };
    const deadline = Date.now() + budgetMs;
    let next = 0;

    const worker = async () => {
      while (next < due.length && Date.now() < deadline) {
        const item = due[next++]!;
        let outcome: 'open' | 'missing' | 'error';
        try {
          outcome = (await fetchPosting(item.ref, this.fetcher)).status === 'open' ? 'open' : 'missing';
        } catch {
          outcome = 'error';
        }
        await this.repo.recordCheck(item.applicationId, outcome);
        summary.checked++;
        if (outcome === 'open') summary.stillOpen++;
        else if (outcome === 'missing') summary.missing++;
        else summary.errors++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, due.length) }, worker));
    return summary;
  }
}
