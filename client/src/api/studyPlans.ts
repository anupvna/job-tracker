import type {
  ActivityDay,
  PlanKey,
  PrepGoals,
  PrepGoalsInput,
  ProblemProgress,
  ReviewRating,
  StudyPlan,
  StudyPlanInput,
  StudyPlanState,
} from '@job-tracker/shared';
import { http, toQueryString } from './http';

export const studyPlansApi = {
  get: (planKey: PlanKey) => http<StudyPlanState>(`/api/study-plans/${planKey}`),

  save: (planKey: PlanKey, input: StudyPlanInput) =>
    http<StudyPlan>(`/api/study-plans/${planKey}`, { method: 'PUT', body: JSON.stringify(input) }),

  reset: (planKey: PlanKey) => http<void>(`/api/study-plans/${planKey}`, { method: 'DELETE' }),

  setSolved: (slug: string, solved: boolean, solvedOn: string, rating?: ReviewRating) =>
    http<ProblemProgress | undefined>(`/api/progress/${slug}`, {
      method: 'PUT',
      body: JSON.stringify({ solved, solvedOn, ...(rating ? { rating } : {}) }),
    }),

  /** Forget every solved problem and revision. */
  clearProgress: () => http<{ problems: number; reviews: number }>('/api/progress', { method: 'DELETE' }),

  review: (slug: string, rating: ReviewRating, reviewedOn: string) =>
    http<ProblemProgress>(`/api/progress/${slug}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating, reviewedOn }),
    }),

  activity: (from: string, to: string) =>
    http<ActivityDay[]>(`/api/activity${toQueryString({ from, to })}`),

  goals: () => http<PrepGoals>('/api/goals'),

  saveGoals: (input: PrepGoalsInput) =>
    http<PrepGoals>('/api/goals', { method: 'PUT', body: JSON.stringify(input) }),
};
