import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { migrate } from './db/migrate.js';
import { createPool } from './db/pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Works from both server/src (dev) and server/dist (prod).
const CLIENT_DIR = path.resolve(here, '../../client/dist');

async function main() {
  const config = loadConfig();
  const db = createPool({ connectionString: config.DATABASE_URL, ssl: config.DATABASE_SSL });

  const applied = await migrate(db);
  if (applied.length) console.log(`[db] applied migrations: ${applied.join(', ')}`);

  const app = createApp({ db, config, clientDir: CLIENT_DIR });
  const server = app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`[api] listening on http://localhost:${config.PORT} (${config.NODE_ENV})`);
  });

  // Graceful shutdown so in-flight requests finish and DB connections close cleanly.
  const shutdown = (signal: string) => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(() => {
      db.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
