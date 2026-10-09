import type {
  PlanKey,
  ProblemProgress,
  StudyPlan,
  StudyPlanInput,
  StudyPlanState,
} from '@job-tracker/shared';
import { http } from './http';

export const studyPlansApi = {
  get: (planKey: PlanKey) => http<StudyPlanState>(`/api/study-plans/${planKey}`),

  save: (planKey: PlanKey, input: StudyPlanInput) =>
    http<StudyPlan>(`/api/study-plans/${planKey}`, { method: 'PUT', body: JSON.stringify(input) }),

  reset: (planKey: PlanKey) => http<void>(`/api/study-plans/${planKey}`, { method: 'DELETE' }),

  setSolved: (slug: string, solved: boolean, solvedOn: string) =>
    http<ProblemProgress | undefined>(`/api/progress/${slug}`, {
      method: 'PUT',
      body: JSON.stringify({ solved, solvedOn }),
    }),
};
