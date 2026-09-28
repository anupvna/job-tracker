import type {
  Application,
  CreateApplicationInput,
  UpdateApplicationInput,
} from '@job-tracker/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applicationsApi, type ApplicationFilters } from '../api/applications';
import { todayISO } from '../lib/dates';

export const applicationKeys = {
  all: ['applications'] as const,
  lists: () => [...applicationKeys.all, 'list'] as const,
  list: (filters: ApplicationFilters, today: string) =>
    [...applicationKeys.lists(), filters, today] as const,
  stats: (today: string) => [...applicationKeys.all, 'stats', today] as const,
};

export function useApplicationsList(filters: ApplicationFilters) {
  const today = todayISO();
  return useQuery({
    queryKey: applicationKeys.list(filters, today),
    queryFn: () => applicationsApi.list(filters, today),
    // Keep showing the old rows while a new filter loads, instead of flashing a skeleton.
    placeholderData: keepPreviousData,
  });
}

export function useApplicationStats() {
  const today = todayISO();
  return useQuery({
    queryKey: applicationKeys.stats(today),
    queryFn: () => applicationsApi.stats(today),
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: applicationKeys.all });
}

export function useCreateApplication() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: CreateApplicationInput) => applicationsApi.create(input),
    onSuccess: invalidate,
  });
}

/** Update with an optimistic patch so inline edits (e.g. status) feel instant. */
export function useUpdateApplication() {
  const qc = useQueryClient();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateApplicationInput }) =>
      applicationsApi.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: applicationKeys.lists() });
      const snapshot = qc.getQueriesData<Application[]>({ queryKey: applicationKeys.lists() });
      qc.setQueriesData<Application[]>({ queryKey: applicationKeys.lists() }, (rows) =>
        rows?.map((row) => (row.id === id ? ({ ...row, ...patch } as Application) : row)),
      );
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: invalidate,
  });
}

export function useDeleteApplication() {
  const qc = useQueryClient();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => applicationsApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: applicationKeys.lists() });
      const snapshot = qc.getQueriesData<Application[]>({ queryKey: applicationKeys.lists() });
      qc.setQueriesData<Application[]>({ queryKey: applicationKeys.lists() }, (rows) =>
        rows?.filter((row) => row.id !== id),
      );
      return { snapshot };
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: invalidate,
  });
}

export function useLoadSampleData() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: applicationsApi.loadSampleData,
    onSuccess: invalidate,
  });
}
