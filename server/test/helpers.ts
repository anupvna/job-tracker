import request from 'supertest';
import { createApp } from '../src/app.js';
import { createPool } from '../src/db/pool.js';

/*
 * Shared setup for integration tests: real Express app + real Postgres (no mocks).
 * Point TEST_DATABASE_URL at a throwaway database; tables are truncated between tests.
 */
const connectionString =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/job_tracker_test';

export const db = createPool({ connectionString });
export const app = createApp({ db, config: { NODE_ENV: 'test' } });

export type Client = ReturnType<typeof request.agent>;

/** A cookie-keeping client that sends the CSRF header, like the real frontend. */
export function client(): Client {
  return request.agent(app).set('X-Requested-With', 'fetch');
}

let counter = 0;

/** Sign up a fresh user and return a client holding their session. */
export async function signedInClient(name = 'Test User'): Promise<Client> {
  const c = client();
  counter += 1;
  await c
    .post('/api/auth/signup')
    .send({ name, email: `user${counter}-${Date.now()}@example.com`, password: 'correct horse' })
    .expect(201);
  return c;
}

export async function resetDb() {
  await db.query('TRUNCATE users, sessions, applications, tasks, study_plans, problem_progress, problem_reviews, prep_goals CASCADE');
}
