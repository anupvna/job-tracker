import { createServer } from 'node:http';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

/*
 * Exercises the Vercel entry point (server/src/vercel.ts) exactly as the serverless runtime
 * calls it: a plain (req, res) handler that lazily connects, migrates, then serves Express.
 */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/job_tracker_test';
process.env.CRON_SECRET = 'test-cron-secret';

let server: ReturnType<typeof createServer>;

beforeAll(async () => {
  const { default: handler } = await import('../src/vercel.js');
  server = createServer(handler);
});

describe('Vercel serverless handler', () => {
  it('serves the API after lazy startup', async () => {
    const res = await request(server).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('issues Secure session cookies (production settings)', async () => {
    const res = await request(server)
      .post('/api/auth/demo')
      .set('X-Requested-With', 'fetch')
      .expect(201);
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';');
    expect(cookie).toMatch(/jt_session=/);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('protects the cron cleanup endpoint with the shared secret', async () => {
    await request(server).get('/api/cron/purge').expect(401);
    const res = await request(server)
      .get('/api/cron/purge')
      .set('Authorization', 'Bearer test-cron-secret')
      .expect(200);
    expect(res.body).toHaveProperty('demoUsers');
    expect(res.body).toHaveProperty('sessions');
  });
});
