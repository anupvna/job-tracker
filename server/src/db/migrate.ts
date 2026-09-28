import type { Db } from './pool.js';
import { migrations as defaultMigrations, type Migration } from './migrations.js';

// Arbitrary constant so concurrent app instances don't run migrations at the same time.
const MIGRATION_LOCK_ID = 727_001;

/**
 * Apply any pending migrations, all inside ONE transaction guarded by a transaction-scoped
 * advisory lock. The lock is released automatically on COMMIT/ROLLBACK, which keeps this safe
 * behind connection poolers (e.g. Neon's PgBouncer) that may hand each statement to a
 * different server connection outside a transaction. Returns the ids that were applied.
 */
export async function migrate(db: Db, migrations: Migration[] = defaultMigrations) {
  const client = await db.connect();
  const applied: string[] = [];
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await client.query<{ id: string }>('SELECT id FROM schema_migrations');
    const done = new Set(rows.map((r) => r.id));

    for (const m of migrations) {
      if (done.has(m.id)) continue;
      try {
        await client.query(m.sql);
      } catch (err) {
        throw new Error(`Migration ${m.id} failed: ${(err as Error).message}`);
      }
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [m.id]);
      applied.push(m.id);
    }
    await client.query('COMMIT');
    return applied;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
