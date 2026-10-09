import { Router } from 'express';
import {
  planKeyParamSchema,
  problemSlugParamSchema,
  progressInputSchema,
  studyPlanInputSchema,
} from '@job-tracker/shared';
import { HttpError } from '../../lib/httpError.js';
import { currentUser } from '../../middleware/auth.js';
import { parseOrThrow } from '../../middleware/validate.js';
import type { StudyPlansRepository } from './studyPlans.repository.js';

/** /api/study-plans/:planKey — the plan settings plus the user's solved problems. */
export function studyPlansRouter(repo: StudyPlansRepository): Router {
  const router = Router();

  router.get('/:planKey', async (req, res) => {
    const { planKey } = parseOrThrow(planKeyParamSchema, req.params);
    res.json(await repo.state(currentUser(req).id, planKey));
  });

  // Create or change pace / study days / start date. Progress is never touched.
  router.put('/:planKey', async (req, res) => {
    const { planKey } = parseOrThrow(planKeyParamSchema, req.params);
    const input = parseOrThrow(studyPlanInputSchema, req.body);
    res.json(await repo.upsertPlan(currentUser(req).id, planKey, input));
  });

  // Stop the plan. Solved problems are kept, so restarting later doesn't lose anything.
  router.delete('/:planKey', async (req, res) => {
    const { planKey } = parseOrThrow(planKeyParamSchema, req.params);
    if (!(await repo.deletePlan(currentUser(req).id, planKey))) {
      throw HttpError.notFound('No active plan');
    }
    res.status(204).end();
  });

  return router;
}

/** /api/progress/:slug — tick a problem solved / unsolved. */
export function progressRouter(repo: StudyPlansRepository): Router {
  const router = Router();

  router.put('/:slug', async (req, res) => {
    const { slug } = parseOrThrow(problemSlugParamSchema, req.params);
    const { solved, solvedOn } = parseOrThrow(progressInputSchema, req.body);
    const userId = currentUser(req).id;
    if (solved) {
      res.json(await repo.markSolved(userId, slug, solvedOn));
    } else {
      await repo.markUnsolved(userId, slug);
      res.status(204).end();
    }
  });

  return router;
}
