import { Router } from 'express';
import {
  createApplicationSchema,
  idParamSchema,
  listApplicationsQuerySchema,
  statsQuerySchema,
  updateApplicationSchema,
} from '@job-tracker/shared';
import { parseOrThrow } from '../../middleware/validate.js';
import type { ApplicationsService } from './applications.service.js';

/**
 * REST routes for /api/applications.
 * Express 5 forwards rejected promises to the error handler, so no try/catch needed.
 */
export function applicationsRouter(service: ApplicationsService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parseOrThrow(listApplicationsQuerySchema, req.query);
    res.json(await service.list(query));
  });

  // Declared before '/:id' so "stats" isn't treated as an id.
  router.get('/stats', async (req, res) => {
    const { today } = parseOrThrow(statsQuerySchema, req.query);
    res.json(await service.stats(today));
  });

  router.post('/sample-data', async (_req, res) => {
    const inserted = await service.loadSampleData();
    res.status(201).json({ inserted });
  });

  router.get('/:id', async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    res.json(await service.get(id));
  });

  router.post('/', async (req, res) => {
    const input = parseOrThrow(createApplicationSchema, req.body);
    const created = await service.create(input);
    res.status(201).location(`${req.baseUrl}/${created.id}`).json(created);
  });

  router.patch('/:id', async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const patch = parseOrThrow(updateApplicationSchema, req.body);
    res.json(await service.update(id, patch));
  });

  router.delete('/:id', async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    await service.remove(id);
    res.status(204).end();
  });

  return router;
}
