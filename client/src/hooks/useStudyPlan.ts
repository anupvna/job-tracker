import {
  NEETCODE_150,
  buildSchedule,
  type StudyPlanInput,
  type StudyPlanState,
} from '@job-tracker/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { studyPlansApi } from '../api/studyPlans';
import { todayISO } from '../lib/dates';

const PLAN = 'neetcode150' as const;
export const studyPlanKey = ['study-plan', PLAN] as const;

export function useStudyPlan() {
  const query = useQuery({ queryKey: studyPlanKey, queryFn: () => studyPlansApi.get(PLAN) });
  const today = todayISO();

  const solved = useMemo(
    () => new Map((query.data?.progress ?? []).map((p) => [p.slug, p.solvedOn] as const)),
    [query.data],
  );

  const schedule = useMemo(() => {
    const plan = query.data?.plan;
    if (!plan) return null;
    return buildSchedule({
      problems: NEETCODE_150,
      solved,
      pace: plan.pace,
      studyDays: plan.studyDays,
      startDate: plan.startDate,
      today,
    });
  }, [query.data, solved, today]);

  return { ...query, plan: query.data?.plan ?? null, solved, schedule, today };
}

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StudyPlanInput) => studyPlansApi.save(PLAN, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: studyPlanKey }),
  });
}

export function useResetPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => studyPlansApi.reset(PLAN),
    onSuccess: () => qc.invalidateQueries({ queryKey: studyPlanKey }),
  });
}

/** Tick a problem solved/unsolved — optimistic, so the checklist feels instant. */
export function useToggleProblem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, solved }: { slug: string; solved: boolean }) =>
      studyPlansApi.setSolved(slug, solved, todayISO()),
    onMutate: async ({ slug, solved }) => {
      await qc.cancelQueries({ queryKey: studyPlanKey });
      const snapshot = qc.getQueryData<StudyPlanState>(studyPlanKey);
      qc.setQueryData<StudyPlanState>(studyPlanKey, (s) =>
        s && {
          ...s,
          progress: solved
            ? [...s.progress.filter((p) => p.slug !== slug), { slug, solvedOn: todayISO() }]
            : s.progress.filter((p) => p.slug !== slug),
        },
      );
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(studyPlanKey, ctx.snapshot);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: studyPlanKey }),
  });
}
