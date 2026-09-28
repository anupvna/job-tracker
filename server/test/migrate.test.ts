import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { db } from './helpers.js';

const cleanup = async () => {
  await db.query('DROP TABLE IF EXISTS mt_ok, mt_once');
  await db.query(`DELETE FROM schema_migrations WHERE id LIKE 'mt_%'`);
};

beforeAll(async () => {
  await migrate(db);
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.end();
});

describe('migrate', () => {
  it('is all-or-nothing: a failing migration rolls back the ones before it', async () => {
    await expect(
      migrate(db, [
        { id: 'mt_ok', sql: 'CREATE TABLE mt_ok (x int)' },
        { id: 'mt_bad', sql: 'THIS IS NOT SQL' },
      ]),
    ).rejects.toThrow(/mt_bad failed/);

    const { rows } = await db.query(`SELECT to_regclass('mt_ok') AS t`);
    expect(rows[0].t).toBeNull();
    const recorded = await db.query(`SELECT id FROM schema_migrations WHERE id LIKE 'mt_%'`);
    expect(recorded.rows).toEqual([]);
  });

  it('applies each migration exactly once, even when instances start at the same time', async () => {
    const m = [{ id: 'mt_once', sql: 'CREATE TABLE mt_once (x int)' }];
    const results = await Promise.all([migrate(db, m), migrate(db, m), migrate(db, m)]);
    expect(results.flat()).toEqual(['mt_once']);
    expect(await migrate(db, m)).toEqual([]);
  });
});
