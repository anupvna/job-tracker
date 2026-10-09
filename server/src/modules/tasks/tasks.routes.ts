import { Router } from 'express';
import {
  createTaskSchema,
  idParamSchema,
  listTasksQuerySchema,
  taskCountsQuerySchema,
  updateTaskSchema,
} from '@job-tracker/shared';
import { currentUser } from '../../middleware/auth.js';
import { parseOrThrow } from '../../middleware/validate.js';
import type { TasksService } from './tasks.service.js';

/** REST routes for /api/tasks, mounted behind `requireAuth`. */
export function tasksRouter(service: TasksService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parseOrThrow(listTasksQuerySchema, req.query);
    res.json(await service.list(currentUser(req).id, query));
  });

  // Before '/:id' style routes so "counts" is never read as an id.
  router.get('/counts', async (req, res) => {
    const { today } = parseOrThrow(taskCountsQuerySchema, req.query);
    res.json(await service.counts(currentUser(req).id, today));
  });

  router.post('/', async (req, res) => {
    const input = parseOrThrow(createTaskSchema, req.body);
    const created = await service.create(currentUser(req).id, input);
    res.status(201).location(`${req.baseUrl}/${created.id}`).json(created);
  });

  router.patch('/:id', async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const patch = parseOrThrow(updateTaskSchema, req.body);
    res.json(await service.update(currentUser(req).id, id, patch));
  });

  router.delete('/:id', async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    await service.remove(currentUser(req).id, id);
    res.status(204).end();
  });

  return router;
}
