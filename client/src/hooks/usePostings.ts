import type { SnapshotSummary } from '@job-tracker/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { postingsApi } from '../api/postings';

export const postingKeys = {
  all: ['job-postings'] as const,
  status: () => [...postingKeys.all, 'status'] as const,
  snapshot: (id: string) => [...postingKeys.all, 'snapshot', id] as const,
};

/** Posting status per application id (for "Posting closed" badges). */
export function usePostingStatus() {
  const query = useQuery({ queryKey: postingKeys.status(), queryFn: postingsApi.status });
  const byApp = useMemo(
    () => new Map<string, SnapshotSummary>((query.data ?? []).map((s) => [s.applicationId, s])),
    [query.data],
  );
  return { ...query, byApp };
}

export function useSnapshot(applicationId: string) {
  return useQuery({
    queryKey: postingKeys.snapshot(applicationId),
    queryFn: () => postingsApi.get(applicationId),
  });
}

function useInvalidatePostings() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: postingKeys.all });
}

export function useSaveSnapshot() {
  const invalidate = useInvalidatePostings();
  return useMutation({ mutationFn: postingsApi.saveFromLink, onSuccess: invalidate });
}

export function useSaveManualSnapshot() {
  const invalidate = useInvalidatePostings();
  return useMutation({
    mutationFn: ({ id, description }: { id: string; description: string }) =>
      postingsApi.saveManual(id, description),
    onSuccess: invalidate,
  });
}

export function useBackfillSnapshots() {
  const invalidate = useInvalidatePostings();
  return useMutation({ mutationFn: postingsApi.backfill, onSuccess: invalidate });
}
