import {
  NEETCODE_150,
  afterReview,
  buildSchedule,
  firstReview,
  type PrepGoalsInput,
  type ProblemProgress,
  type ReviewRating,
  type StudyPlanInput,
  type StudyPlanState,
} from '@job-tracker/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { studyPlansApi } from '../api/studyPlans';
import { addDays, todayISO } from '../lib/dates';

const PLAN = 'neetcode150' as const;
export const studyPlanKey = ['study-plan', PLAN] as const;
export const activityKey = ['activity'] as const;
export const goalsKey = ['goals'] as const;

/** Heatmap window: this many full weeks (ending this week). */
export const HEATMAP_WEEKS = 26;

export function useStudyPlan() {
  const query = useQuery({ queryKey: studyPlanKey, queryFn: () => studyPlansApi.get(PLAN) });
  const today = todayISO();

  const progress = useMemo(
    () => new Map((query.data?.progress ?? []).map((p) => [p.slug, p] as const)),
    [query.data],
  );
  const solved = useMemo(
    () => new Map([...progress.values()].map((p) => [p.slug, p.solvedOn] as const)),
    [progress],
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

  return { ...query, plan: query.data?.plan ?? null, progress, solved, schedule, today };
}

/** Apply a change to one problem's progress in the cache; returns a rollback snapshot. */
async function patchProgress(
  qc: QueryClient,
  slug: string,
  change: (current: ProblemProgress | undefined) => ProblemProgress | null,
) {
  await qc.cancelQueries({ queryKey: studyPlanKey });
  const snapshot = qc.getQueryData<StudyPlanState>(studyPlanKey);
  qc.setQueryData<StudyPlanState>(studyPlanKey, (s) => {
    if (!s) return s;
    const current = s.progress.find((p) => p.slug === slug);
    const next = change(current);
    const rest = s.progress.filter((p) => p.slug !== slug);
    return { ...s, progress: next ? [...rest, next] : rest };
  });
  return { snapshot };
}

function useProgressMutation<V, D>(
  mutationFn: (vars: V) => Promise<D>,
  optimistic: (vars: V) => { slug: string; change: (p: ProblemProgress | undefined) => ProblemProgress | null },
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: (vars: V) => {
      const { slug, change } = optimistic(vars);
      return patchProgress(qc, slug, change);
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(studyPlanKey, ctx.snapshot);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: studyPlanKey });
      qc.invalidateQueries({ queryKey: activityKey });
    },
  });
}

function freshProgress(slug: string, rating: ReviewRating, solvedOn: string): ProblemProgress {
  const r = firstReview(rating, solvedOn);
  return {
    slug,
    solvedOn,
    rating,
    reviewStage: r.stage,
    nextReviewOn: r.nextReviewOn,
    lastReviewedOn: null,
    reviewCount: 0,
  };
}

/** Tick a problem solved/unsolved — optimistic, so the checklist feels instant. */
export function useToggleProblem() {
  return useProgressMutation(
    ({ slug, solved }: { slug: string; solved: boolean }) =>
      studyPlansApi.setSolved(slug, solved, todayISO()),
    ({ slug, solved }) => ({
      slug,
      change: (p) => (solved ? (p ?? freshProgress(slug, 'ok', todayISO())) : null),
    }),
  );
}

/** Say how a fresh solve felt (until its first review): sets when it comes back. */
export function useRateProblem() {
  return useProgressMutation(
    ({ slug, rating }: { slug: string; rating: ReviewRating }) =>
      studyPlansApi.setSolved(slug, true, todayISO(), rating),
    ({ slug, rating }) => ({
      slug,
      change: (p) =>
        p && p.reviewCount === 0 ? { ...freshProgress(slug, rating, p.solvedOn) } : (p ?? null),
    }),
  );
}

/** Log a revision with a rating. */
export function useReviewProblem() {
  return useProgressMutation(
    ({ slug, rating }: { slug: string; rating: ReviewRating }) =>
      studyPlansApi.review(slug, rating, todayISO()),
    ({ slug, rating }) => ({
      slug,
      change: (p) => {
        if (!p) return null;
        const next = afterReview(p.reviewStage, rating, todayISO());
        return {
          ...p,
          reviewStage: next.stage,
          nextReviewOn: next.nextReviewOn,
          lastReviewedOn: todayISO(),
          reviewCount: p.reviewCount + 1,
        };
      },
    }),
  );
}

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StudyPlanInput) => studyPlansApi.save(PLAN, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: studyPlanKey }),
  });
}

/** Stop the plan; optionally also wipe solved problems and revision history. */
export function useResetPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clearProgress }: { clearProgress: boolean }) => {
      await studyPlansApi.reset(PLAN);
      if (clearProgress) await studyPlansApi.clearProgress();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studyPlanKey });
      qc.invalidateQueries({ queryKey: activityKey });
    },
  });
}

/** Solves + reviews per day for the heatmap window. */
export function useActivity() {
  const today = todayISO();
  // From the Monday HEATMAP_WEEKS-1 weeks before this week's Monday.
  const wd = new Date(`${today}T00:00:00`).getDay();
  const from = addDays(today, -((wd + 6) % 7) - (HEATMAP_WEEKS - 1) * 7);
  return useQuery({
    queryKey: [...activityKey, from, today],
    queryFn: () => studyPlansApi.activity(from, today),
  });
}

export function useGoals() {
  return useQuery({ queryKey: goalsKey, queryFn: studyPlansApi.goals });
}

export function useSaveGoals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PrepGoalsInput) => studyPlansApi.saveGoals(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: goalsKey }),
  });
}
