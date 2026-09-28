import type {
  Application,
  ApplicationStats,
  ApplicationStatus,
  CreateApplicationInput,
  SortField,
  UpdateApplicationInput,
} from '@job-tracker/shared';
import { http, toQueryString } from './http';

export interface ApplicationFilters {
  status?: ApplicationStatus;
  q?: string;
  overdue?: boolean;
  sort: SortField;
  order: 'asc' | 'desc';
}

const BASE = '/api/applications';

export const applicationsApi = {
  list: (filters: ApplicationFilters, today: string) =>
    http<Application[]>(`${BASE}${toQueryString({ ...filters, today })}`),

  stats: (today: string) => http<ApplicationStats>(`${BASE}/stats${toQueryString({ today })}`),

  create: (input: CreateApplicationInput) =>
    http<Application>(BASE, { method: 'POST', body: JSON.stringify(input) }),

  update: (id: string, patch: UpdateApplicationInput) =>
    http<Application>(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  remove: (id: string) => http<void>(`${BASE}/${id}`, { method: 'DELETE' }),

  loadSampleData: () => http<{ inserted: number }>(`${BASE}/sample-data`, { method: 'POST' }),
};
