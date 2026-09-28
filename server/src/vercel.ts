import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { migrate } from './db/migrate.js';
import { createPool } from './db/pool.js';

/*
 * Entry point for Vercel's serverless runtime. Instead of `app.listen()`, Vercel calls this
 * handler once per request. Everything expensive (config, DB pool, migrations) happens once per
 * warm instance and is reused by later requests.
 */

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let init: Promise<Handler> | undefined;

async function build(): Promise<Handler> {
  // Vercel always serves over HTTPS, so production cookie settings apply.
  const config = loadConfig({ ...process.env, NODE_ENV: 'production' });
  // Serverless instances are many and short-lived: keep each one's pool small.
  const db = createPool({
    connectionString: config.DATABASE_URL,
    ssl: config.DATABASE_SSL,
    max: 3,
  });
  const applied = await migrate(db);
  if (applied.length) console.log(`[db] applied migrations: ${applied.join(', ')}`);
  return createApp({ db, config });
}

function sendError(res: ServerResponse, status: number, code: string, message: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: { code, message } }));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  init ??= build();
  let app: Handler;
  try {
    app = await init;
  } catch (err) {
    init = undefined; // retry on the next request (e.g. the database was waking up)
    console.error('[vercel] startup failed', err);
    sendError(res, 503, 'UNAVAILABLE', 'The server is starting up. Please try again in a moment.');
    return;
  }
  app(req, res);
}
