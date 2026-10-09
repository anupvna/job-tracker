import { Router } from 'express';
import {
  activityQuerySchema,
  planKeyParamSchema,
  prepGoalsSchema,
  problemSlugParamSchema,
  progressInputSchema,
  reviewInputSchema,
  studyPlanInputSchema,
} from '@job-tracker/shared';
import { HttpError } from '../../lib/httpError.js';
import { currentUser } from '../../middleware/auth.js';
import { parseOrThrow } from '../../middleware/validate.js';
import type { StudyPlansRepository } from './studyPlans.repository.js';
import type { ProgressService } from './studyPlans.service.js';

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

/** /api/progress/:slug — tick a problem solved / unsolved, and log revisions. */
export function progressRouter(repo: StudyPlansRepository, progress: ProgressService): Router {
  const router = Router();

  router.put('/:slug', async (req, res) => {
    const { slug } = parseOrThrow(problemSlugParamSchema, req.params);
    const { solved, solvedOn, rating } = parseOrThrow(progressInputSchema, req.body);
    const userId = currentUser(req).id;
    if (solved) {
      res.json(await progress.solve(userId, slug, solvedOn, rating));
    } else {
      await repo.markUnsolved(userId, slug);
      res.status(204).end();
    }
  });

  router.post('/:slug/review', async (req, res) => {
    const { slug } = parseOrThrow(problemSlugParamSchema, req.params);
    const { rating, reviewedOn } = parseOrThrow(reviewInputSchema, req.body);
    res.json(await progress.review(currentUser(req).id, slug, rating, reviewedOn));
  });

  return router;
}

/** /api/activity — solves + reviews per day (heatmap, streaks). */
export function activityRouter(repo: StudyPlansRepository): Router {
  const router = Router();
  router.get('/', async (req, res) => {
    const { from, to } = parseOrThrow(activityQuerySchema, req.query);
    res.json(await repo.activity(currentUser(req).id, from, to));
  });
  return router;
}

/** /api/goals — goal date and weekly targets (defaults until saved). */
export function goalsRouter(repo: StudyPlansRepository): Router {
  const router = Router();
  router.get('/', async (req, res) => {
    res.json(await repo.goals(currentUser(req).id));
  });
  router.put('/', async (req, res) => {
    const input = parseOrThrow(prepGoalsSchema, req.body);
    res.json(await repo.saveGoals(currentUser(req).id, input));
  });
  return router;
}
