import pg from 'pg';

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Dates, which would
// otherwise be shifted by the server's timezone.
const DATE_OID = 1082;
pg.types.setTypeParser(DATE_OID, (value) => value);

export type Db = pg.Pool;

export function createPool(opts: { connectionString: string; ssl?: boolean }): Db {
  const pool = new pg.Pool({
    connectionString: opts.connectionString,
    ssl: opts.ssl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  pool.on('error', (err) => {
    // An idle client errored (e.g. the DB restarted). Log it; the pool will reconnect.
    console.error('[db] idle client error', err);
  });
  return pool;
}
