import type {
  Application,
  ApplicationStats,
  CreateApplication,
  ListApplicationsQuery,
  UpdateApplication,
} from '@job-tracker/shared';
import { HttpError } from '../../lib/httpError.js';
import { todayISO } from '../../lib/dates.js';
import { seed } from '../../db/seed.js';
import type { ApplicationsRepository } from './applications.repository.js';

/** Business logic for applications. Knows nothing about HTTP or SQL. */
export class ApplicationsService {
  constructor(private readonly repo: ApplicationsRepository) {}

  list(userId: string, query: ListApplicationsQuery): Promise<Application[]> {
    return this.repo.list(userId, { ...query, today: query.today ?? todayISO() });
  }

  stats(userId: string, today?: string): Promise<ApplicationStats> {
    return this.repo.stats(userId, today ?? todayISO());
  }

  async get(userId: string, id: string): Promise<Application> {
    const app = await this.repo.findById(userId, id);
    if (!app) throw HttpError.notFound('Application not found');
    return app;
  }

  create(userId: string, input: CreateApplication): Promise<Application> {
    return this.repo.create(userId, input);
  }

  async update(userId: string, id: string, patch: UpdateApplication): Promise<Application> {
    const app = await this.repo.update(userId, id, patch);
    if (!app) throw HttpError.notFound('Application not found');
    return app;
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.repo.delete(userId, id);
    if (!deleted) throw HttpError.notFound('Application not found');
  }

  /** Fill an empty tracker with realistic examples (powers the "Load sample data" button). */
  async loadSampleData(userId: string): Promise<number> {
    const { total } = await this.repo.stats(userId, todayISO());
    if (total > 0) {
      throw new HttpError(409, 'NOT_EMPTY', 'Sample data can only be loaded into an empty tracker');
    }
    return seed(this.repo, userId);
  }
}
