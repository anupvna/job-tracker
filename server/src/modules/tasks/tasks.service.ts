import {
  TASK_LIMITS,
  type CreateTask,
  type ListTasksQuery,
  type Task,
  type TaskCounts,
  type UpdateTask,
} from '@job-tracker/shared';
import { HttpError } from '../../lib/httpError.js';
import type { TasksRepository } from './tasks.repository.js';

/** Business rules for planner tasks. Knows nothing about HTTP requests. */
export class TasksService {
  constructor(private readonly repo: TasksRepository) {}

  list(userId: string, query: ListTasksQuery): Promise<Task[]> {
    return this.repo.list(userId, query);
  }

  counts(userId: string, today: string): Promise<TaskCounts> {
    return this.repo.counts(userId, today);
  }

  async create(userId: string, input: CreateTask): Promise<Task> {
    if ((await this.repo.countAll(userId)) >= TASK_LIMITS.perUser) {
      throw new HttpError(
        409,
        'TASK_LIMIT',
        `You can keep up to ${TASK_LIMITS.perUser} tasks. Delete some completed ones first.`,
      );
    }
    return this.repo.create(userId, input);
  }

  async update(userId: string, id: string, patch: UpdateTask): Promise<Task> {
    const task = await this.repo.update(userId, id, patch);
    if (!task) throw HttpError.notFound('Task not found');
    return task;
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.repo.delete(userId, id))) throw HttpError.notFound('Task not found');
  }
}
