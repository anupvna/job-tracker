import type {
  CreateTaskInput,
  Task,
  TaskCounts,
  TaskView,
  UpdateTaskInput,
} from '@job-tracker/shared';
import { http, toQueryString } from './http';

const BASE = '/api/tasks';

export const tasksApi = {
  list: (view: TaskView, today: string) => http<Task[]>(`${BASE}${toQueryString({ view, today })}`),

  counts: (today: string) => http<TaskCounts>(`${BASE}/counts${toQueryString({ today })}`),

  create: (input: CreateTaskInput) =>
    http<Task>(BASE, { method: 'POST', body: JSON.stringify(input) }),

  update: (id: string, patch: UpdateTaskInput) =>
    http<Task>(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  remove: (id: string) => http<void>(`${BASE}/${id}`, { method: 'DELETE' }),
};
