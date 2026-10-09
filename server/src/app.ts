import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import type { Config } from './config.js';
import type { Db } from './db/pool.js';
import { loadUser, requireAuth, requireCsrfHeader } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { ApplicationsRepository } from './modules/applications/applications.repository.js';
import { applicationsRouter } from './modules/applications/applications.routes.js';
import { ApplicationsService } from './modules/applications/applications.service.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import { StudyPlansRepository } from './modules/studyPlans/studyPlans.repository.js';
import {
  activityRouter,
  goalsRouter,
  progressRouter,
  studyPlansRouter,
} from './modules/studyPlans/studyPlans.routes.js';
import { ProgressService } from './modules/studyPlans/studyPlans.service.js';
import { TasksRepository } from './modules/tasks/tasks.repository.js';
import { tasksRouter } from './modules/tasks/tasks.routes.js';
import { TasksService } from './modules/tasks/tasks.service.js';

interface AppDeps {
  db: Db;
  config: Pick<Config, 'NODE_ENV'> & Partial<Pick<Config, 'CRON_SECRET'>>;
  /** Directory of the built React app to serve. Omit to run the API only. */
  clientDir?: string;
}

/** Build the Express app. Dependencies are injected so tests can supply their own DB. */
export function createApp({ db, config, clientDir }: AppDeps) {
  const app = express();
  const isTest = config.NODE_ENV === 'test';

  app.set('trust proxy', 1); // behind Replit / Render / Fly proxies
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  if (!isTest) app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // Cap write traffic per IP so the public demo can't be flooded.
  if (!isTest) {
    app.use(
      '/api',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 300,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        skip: (req) => req.method === 'GET',
      }),
    );
  }

  // ---- API ----
  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });

  const applicationsRepo = new ApplicationsRepository(db);
  const tasksRepo = new TasksRepository(db);
  const studyPlansRepo = new StudyPlansRepository(db);
  const auth = new AuthService(new AuthRepository(db), applicationsRepo, tasksRepo, studyPlansRepo);

  // Scheduled cleanup (Vercel Cron calls this daily; long-running servers also sweep hourly).
  app.get('/api/cron/purge', async (req, res) => {
    if (config.CRON_SECRET && req.get('authorization') !== `Bearer ${config.CRON_SECRET}`) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' } });
      return;
    }
    res.json(await auth.purgeExpired());
  });

  app.use('/api', requireCsrfHeader, loadUser(auth));
  app.use(
    '/api/auth',
    authRouter(auth, { secureCookies: config.NODE_ENV === 'production', rateLimit: !isTest }),
  );
  app.use(
    '/api/applications',
    requireAuth,
    applicationsRouter(new ApplicationsService(applicationsRepo)),
  );
  app.use('/api/tasks', requireAuth, tasksRouter(new TasksService(tasksRepo)));
  app.use('/api/study-plans', requireAuth, studyPlansRouter(studyPlansRepo));
  app.use(
    '/api/progress',
    requireAuth,
    progressRouter(studyPlansRepo, new ProgressService(studyPlansRepo)),
  );
  app.use('/api/activity', requireAuth, activityRouter(studyPlansRepo));
  app.use('/api/goals', requireAuth, goalsRouter(studyPlansRepo));
  app.use('/api', notFoundHandler);

  // ---- Frontend (single-page app) ----
  if (clientDir && fs.existsSync(path.join(clientDir, 'index.html'))) {
    app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
    // Hashed assets never change, so cache them hard.
    app.use(
      '/assets',
      express.static(path.join(clientDir, 'assets'), { immutable: true, maxAge: '1y' }),
    );
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return Object.assign(app, { auth });
}
