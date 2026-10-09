import type { CreateTaskInput, Task, TaskView, UpdateTaskInput } from '@job-tracker/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../api/tasks';
import { todayISO } from '../lib/dates';

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (view: TaskView, today: string) => [...taskKeys.lists(), view, today] as const,
  counts: (today: string) => [...taskKeys.all, 'counts', today] as const,
};

export function useTasks(view: TaskView) {
  const today = todayISO();
  return useQuery({
    queryKey: taskKeys.list(view, today),
    queryFn: () => tasksApi.list(view, today),
  });
}

export function useTaskCounts() {
  const today = todayISO();
  return useQuery({ queryKey: taskKeys.counts(today), queryFn: () => tasksApi.counts(today) });
}

function useInvalidateTasks() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: taskKeys.all });
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => tasksApi.create(input),
    onSuccess: invalidate,
  });
}

/**
 * Optimistic: completing/reopening a task or moving its date takes it out of the list
 * you're looking at immediately; the server response then refreshes every list.
 */
export function useUpdateTask() {
  const qc = useQueryClient();
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTaskInput }) =>
      tasksApi.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: taskKeys.lists() });
      const snapshot = qc.getQueriesData<Task[]>({ queryKey: taskKeys.lists() });
      const leavesList = patch.done !== undefined || patch.dueDate !== undefined;
      qc.setQueriesData<Task[]>({ queryKey: taskKeys.lists() }, (rows) =>
        leavesList
          ? rows?.filter((t) => t.id !== id)
          : rows?.map((t) => (t.id === id ? ({ ...t, ...patch } as Task) : t)),
      );
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: invalidate,
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: taskKeys.lists() });
      const snapshot = qc.getQueriesData<Task[]>({ queryKey: taskKeys.lists() });
      qc.setQueriesData<Task[]>({ queryKey: taskKeys.lists() }, (rows) =>
        rows?.filter((t) => t.id !== id),
      );
      return { snapshot };
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: invalidate,
  });
}
