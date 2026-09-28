import { loadConfig } from '../config.js';
import { migrate } from './migrate.js';
import { createPool } from './pool.js';

/** Usage: `npm run db:migrate`. (The server also migrates on startup.) */
async function main() {
  const config = loadConfig();
  const db = createPool({ connectionString: config.DATABASE_URL, ssl: config.DATABASE_SSL });
  try {
    const applied = await migrate(db);
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
