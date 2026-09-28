import { loadConfig } from '../config.js';
import { ApplicationsRepository } from '../modules/applications/applications.repository.js';
import { migrate } from './migrate.js';
import { createPool } from './pool.js';
import { seed } from './seed.js';

/** Usage: `npm run db:migrate` or `npm run db:seed` */
async function main() {
  const command = process.argv[2];
  const config = loadConfig();
  const db = createPool({ connectionString: config.DATABASE_URL, ssl: config.DATABASE_SSL });
  try {
    const applied = await migrate(db);
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
    if (command === 'seed') {
      const count = await seed(new ApplicationsRepository(db));
      console.log(`Seeded ${count} sample applications.`);
    }
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
