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

  list(query: ListApplicationsQuery): Promise<Application[]> {
    return this.repo.list({ ...query, today: query.today ?? todayISO() });
  }

  stats(today?: string): Promise<ApplicationStats> {
    return this.repo.stats(today ?? todayISO());
  }

  async get(id: string): Promise<Application> {
    const app = await this.repo.findById(id);
    if (!app) throw HttpError.notFound('Application not found');
    return app;
  }

  create(input: CreateApplication): Promise<Application> {
    return this.repo.create(input);
  }

  async update(id: string, patch: UpdateApplication): Promise<Application> {
    const app = await this.repo.update(id, patch);
    if (!app) throw HttpError.notFound('Application not found');
    return app;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw HttpError.notFound('Application not found');
  }

  /** Fill an empty tracker with realistic examples (powers the "Load sample data" button). */
  async loadSampleData(): Promise<number> {
    const { total } = await this.repo.stats(todayISO());
    if (total > 0) {
      throw new HttpError(409, 'NOT_EMPTY', 'Sample data can only be loaded into an empty tracker');
    }
    return seed(this.repo);
  }
}
