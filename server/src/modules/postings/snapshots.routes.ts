import { Router } from 'express';
import { idParamSchema, manualSnapshotSchema, postingLookupSchema } from '@job-tracker/shared';
import { HttpError } from '../../lib/httpError.js';
import { currentUser } from '../../middleware/auth.js';
import { parseOrThrow } from '../../middleware/validate.js';
import type { SnapshotsService } from './snapshots.service.js';

/** /api/applications/:id/snapshot — the saved copy of an application's job posting. */
export function snapshotRouter(service: SnapshotsService): Router {
  const router = Router();

  router.get('/:id/snapshot', async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const snapshot = await service.get(currentUser(req).id, id);
    if (!snapshot) throw HttpError.notFound('No saved posting');
    res.json(snapshot);
  });

  // Fetch from the application's (Greenhouse / Lever / Ashby) link and save.
  router.post('/:id/snapshot', async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    res.json(await service.saveFromLink(currentUser(req).id, id));
  });

  // Save a pasted description.
  router.put('/:id/snapshot', async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const { description } = parseOrThrow(manualSnapshotSchema, req.body);
    res.json(await service.saveManual(currentUser(req).id, id, description));
  });

  router.delete('/:id/snapshot', async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    await service.remove(currentUser(req).id, id);
    res.status(204).end();
  });

  return router;
}

/** /api/job-postings — autofill lookups and per-application posting status. */
export function jobPostingsRouter(service: SnapshotsService): Router {
  const router = Router();

  router.post('/lookup', async (req, res) => {
    const { url } = parseOrThrow(postingLookupSchema, req.body);
    res.json(await service.lookup(url));
  });

  // Save copies for existing applications with Greenhouse / Lever / Ashby links.
  router.post('/backfill', async (req, res) => {
    res.json(await service.backfill(currentUser(req).id));
  });

  router.get('/status', async (req, res) => {
    res.json(await service.summaries(currentUser(req).id));
  });

  return router;
}
