import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import type { Config } from './config.js';
import type { Db } from './db/pool.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { ApplicationsRepository } from './modules/applications/applications.repository.js';
import { applicationsRouter } from './modules/applications/applications.routes.js';
import { ApplicationsService } from './modules/applications/applications.service.js';

interface AppDeps {
  db: Db;
  config: Pick<Config, 'NODE_ENV' | 'CORS_ORIGIN'>;
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
  if (config.CORS_ORIGIN) {
    app.use('/api', cors({ origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()) }));
  }
  app.use(express.json({ limit: '100kb' }));
  if (!isTest) app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // No auth, so cap write traffic per IP to keep a public demo from being flooded.
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

  const service = new ApplicationsService(new ApplicationsRepository(db));
  app.use('/api/applications', applicationsRouter(service));
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
  return app;
}
