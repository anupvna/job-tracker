import type { JobSnapshot, PostingLookupResult, SnapshotSummary } from '@job-tracker/shared';
import { ApiError, http } from './http';

export const postingsApi = {
  lookup: (url: string) =>
    http<PostingLookupResult>('/api/job-postings/lookup', { method: 'POST', body: JSON.stringify({ url }) }),

  status: () => http<SnapshotSummary[]>('/api/job-postings/status'),

  backfill: () =>
    http<{ saved: number; closed: number; failed: number; remaining: number }>('/api/job-postings/backfill', {
      method: 'POST',
    }),

  /** The saved copy, or null if there isn't one yet. */
  get: async (applicationId: string) => {
    try {
      return await http<JobSnapshot>(`/api/applications/${applicationId}/snapshot`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  saveFromLink: (applicationId: string) =>
    http<JobSnapshot>(`/api/applications/${applicationId}/snapshot`, { method: 'POST' }),

  saveManual: (applicationId: string, description: string) =>
    http<JobSnapshot>(`/api/applications/${applicationId}/snapshot`, {
      method: 'PUT',
      body: JSON.stringify({ description }),
    }),
};
