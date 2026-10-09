import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Application } from '@job-tracker/shared';
import { createApp } from '../src/app.js';
import { migrate } from '../src/db/migrate.js';
import { db, resetDb } from './helpers.js';

// ---- A fake job-board internet, shaped like the real APIs' responses ----
const GH_URL = 'https://boards-api.greenhouse.io/v1/boards/stripe/jobs/8172487';
const LEVER_ID = '6ed76ce8-4156-4b60-b120-403538bd66cd';
const ASHBY_ID = '7458d4e9-da2e-47bd-98cb-adfda43d42b2';
const responses = new Map<string, () => Response>();
const calls: string[] = [];

const json = (body: unknown, status = 200) => () =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function resetInternet() {
  responses.clear();
  calls.length = 0;
  responses.set(GH_URL, json({
    id: 8172487,
    title: 'Software Engineer, New Grad',
    company_name: 'Stripe',
    location: { name: 'New York' },
    first_published: '2026-09-03T13:30:34-04:00',
    absolute_url: 'https://stripe.com/jobs/search?gh_jid=8172487',
    content: '&lt;h2&gt;About&lt;/h2&gt;&lt;p&gt;Build &amp;amp; ship.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Go&lt;/li&gt;&lt;/ul&gt;',
  }));
  responses.set(`https://api.lever.co/v0/postings/palantir/${LEVER_ID}?mode=json`, json({
    id: LEVER_ID,
    text: 'Forward Deployed Engineer',
    categories: { location: 'New York, NY', team: 'Eng', commitment: 'Full-time' },
    descriptionPlain: 'A World-Changing Company\nWe build software.',
    lists: [{ text: 'What We Require', content: '<li>Strong CS fundamentals</li><li>Curiosity</li>' }],
    additionalPlain: 'Palantir is an equal opportunity employer.',
    hostedUrl: `https://jobs.lever.co/palantir/${LEVER_ID}`,
    createdAt: 1786469891368,
  }));
  responses.set('https://api.ashbyhq.com/posting-api/job-board/ashby', json({
    jobs: [{
      id: ASHBY_ID,
      title: 'Software Engineer',
      location: 'Remote - US',
      descriptionPlain: 'Join Ashby.\n\nYou will use TypeScript & React.',
      publishedAt: '2026-08-01T10:00:00.000+00:00',
      jobUrl: `https://jobs.ashbyhq.com/ashby/${ASHBY_ID}`,
    }],
  }));
}

const fakeFetch = async (url: string | URL | Request) => {
  const u = String(url);
  calls.push(u);
  const r = responses.get(u);
  return r ? r() : new Response('Not found', { status: 404 });
};

const app = createApp({ db, config: { NODE_ENV: 'test', CRON_SECRET: 's3cret' }, fetcher: fakeFetch as typeof fetch });
let n = 0;
async function user() {
  const c = request.agent(app).set('X-Requested-With', 'fetch');
  n += 1;
  await c.post('/api/auth/signup').send({ name: 'P', email: `p${n}-${Date.now()}@example.com`, password: 'correct horse' }).expect(201);
  return c;
}
type Agent = Awaited<ReturnType<typeof user>>;
let agent: Agent;

async function createApp_(body: Record<string, unknown>): Promise<Application> {
  return (await agent.post('/api/applications').send({ company: 'X', role: 'SWE', ...body }).expect(201)).body;
}
const runCron = () => request(app).get('/api/cron/purge').set('Authorization', 'Bearer s3cret').expect(200);
/** Pretend the last check was yesterday so the next cron run picks it up. */
const age = () => db.query("UPDATE job_snapshots SET last_checked_at = now() - interval '1 day'");

beforeAll(async () => {
  await migrate(db);
});
beforeEach(async () => {
  await resetDb();
  await db.query('TRUNCATE job_snapshots');
  resetInternet();
  agent = await user();
});
afterAll(async () => {
  await db.end();
});

describe('POST /api/job-postings/lookup (autofill)', () => {
  it('reads a Greenhouse posting and converts its HTML to text', async () => {
    const res = await agent.post('/api/job-postings/lookup').send({ url: 'https://boards.greenhouse.io/stripe/jobs/8172487' }).expect(200);
    expect(res.body).toEqual({
      supported: true,
      status: 'open',
      posting: {
        source: 'greenhouse',
        company: 'Stripe',
        title: 'Software Engineer, New Grad',
        location: 'New York',
        description: 'About\n\nBuild & ship.\n\n• Go',
        postedAt: '2026-09-03T17:30:34.000Z',
        url: 'https://stripe.com/jobs/search?gh_jid=8172487',
      },
    });
    expect(calls).toEqual([GH_URL]);
  });

  it('reads Lever and Ashby postings', async () => {
    const lever = await agent.post('/api/job-postings/lookup').send({ url: `jobs.lever.co/palantir/${LEVER_ID}` }).expect(200);
    expect(lever.body.posting).toMatchObject({ company: 'Palantir', title: 'Forward Deployed Engineer', location: 'New York, NY' });
    expect(lever.body.posting.description).toContain('What We Require\n• Strong CS fundamentals');
    const ashby = await agent.post('/api/job-postings/lookup').send({ url: `https://jobs.ashbyhq.com/ashby/${ASHBY_ID}` }).expect(200);
    expect(ashby.body.posting).toMatchObject({ company: 'Ashby', title: 'Software Engineer', description: 'Join Ashby.\n\nYou will use TypeScript & React.' });
  });

  it('says when a link is unsupported, without making any request', async () => {
    const res = await agent.post('/api/job-postings/lookup').send({ url: 'https://www.linkedin.com/jobs/view/1' }).expect(200);
    expect(res.body).toEqual({ supported: false });
    expect(calls).toEqual([]);
  });

  it('reports closed postings and upstream failures', async () => {
    const closed = await agent.post('/api/job-postings/lookup').send({ url: 'https://boards.greenhouse.io/stripe/jobs/1' }).expect(200);
    expect(closed.body).toEqual({ supported: true, status: 'closed', source: 'greenhouse' });
    responses.set(GH_URL, json({ error: 'boom' }, 500));
    const err = await agent.post('/api/job-postings/lookup').send({ url: 'https://boards.greenhouse.io/stripe/jobs/8172487' }).expect(502);
    expect(err.body.error.code).toBe('POSTING_UNAVAILABLE');
    responses.set(GH_URL, json({ unexpected: true }));
    await agent.post('/api/job-postings/lookup').send({ url: 'https://boards.greenhouse.io/stripe/jobs/8172487' }).expect(502);
  });

  it('requires a session', async () => {
    await request(app).post('/api/job-postings/lookup').set('X-Requested-With', 'fetch').send({ url: 'x' }).expect(401);
  });
});

describe('saved job postings', () => {
  it('saves a copy from the link, and lists its status', async () => {
    const a = await createApp_({ link: 'https://boards.greenhouse.io/stripe/jobs/8172487' });
    const saved = await agent.post(`/api/applications/${a.id}/snapshot`).expect(200);
    expect(saved.body).toMatchObject({ applicationId: a.id, source: 'greenhouse', title: 'Software Engineer, New Grad', postingStatus: 'open' });
    expect((await agent.get(`/api/applications/${a.id}/snapshot`).expect(200)).body.description).toBe('About\n\nBuild & ship.\n\n• Go');
    expect((await agent.get('/api/job-postings/status').expect(200)).body).toMatchObject([{ applicationId: a.id, postingStatus: 'open' }]);
  });

  it('asks you to paste the description for unsupported links, and saves it', async () => {
    const a = await createApp_({ link: 'https://www.linkedin.com/jobs/view/1' });
    const res = await agent.post(`/api/applications/${a.id}/snapshot`).expect(422);
    expect(res.body.error.code).toBe('UNSUPPORTED_LINK');
    const manual = await agent.put(`/api/applications/${a.id}/snapshot`).send({ description: '  Build things.  ' }).expect(200);
    expect(manual.body).toMatchObject({ source: 'manual', description: 'Build things.', postingStatus: 'unknown' });
    await agent.put(`/api/applications/${a.id}/snapshot`).send({ description: '' }).expect(400);
  });

  it("keeps saved postings private and deletes them with the application", async () => {
    const a = await createApp_({ link: 'https://boards.greenhouse.io/stripe/jobs/8172487' });
    await agent.post(`/api/applications/${a.id}/snapshot`).expect(200);
    const other = await user();
    await other.get(`/api/applications/${a.id}/snapshot`).expect(404);
    await other.post(`/api/applications/${a.id}/snapshot`).expect(404);
    await other.put(`/api/applications/${a.id}/snapshot`).send({ description: 'hijack' }).expect(404);
    expect((await other.get('/api/job-postings/status').expect(200)).body).toEqual([]);
    expect((await agent.get(`/api/applications/${a.id}/snapshot`).expect(200)).body.description).not.toBe('hijack');

    await agent.delete(`/api/applications/${a.id}`).expect(204);
    const { rows } = await db.query('SELECT count(*)::int AS n FROM job_snapshots');
    expect(rows[0].n).toBe(0);
  });
});

describe('backfill', () => {
  it('saves copies for existing applications with supported links, once', async () => {
    const gh = await createApp_({ link: 'https://boards.greenhouse.io/stripe/jobs/8172487' });
    const gone = await createApp_({ link: 'https://boards.greenhouse.io/stripe/jobs/2' });
    await createApp_({ link: 'https://www.linkedin.com/jobs/view/1' });
    await createApp_({});
    const res = await agent.post('/api/job-postings/backfill').expect(200);
    expect(res.body).toEqual({ saved: 1, closed: 1, failed: 0, remaining: 0 });
    const status = (await agent.get('/api/job-postings/status')).body as { applicationId: string; postingStatus: string }[];
    expect(Object.fromEntries(status.map((s) => [s.applicationId, s.postingStatus]))).toEqual({ [gh.id]: 'open', [gone.id]: 'closed' });
    calls.length = 0;
    expect((await agent.post('/api/job-postings/backfill').expect(200)).body).toEqual({ saved: 0, closed: 0, failed: 0, remaining: 0 });
    expect(calls).toEqual([]);
  });
});

describe('daily dead-posting check (cron)', () => {
  it('marks a posting closed only after it is missing on two separate checks', async () => {
    const a = await createApp_({ link: 'https://boards.greenhouse.io/stripe/jobs/8172487', status: 'applied' });
    await agent.post(`/api/applications/${a.id}/snapshot`).expect(200);
    responses.delete(GH_URL); // the company takes the posting down

    await age();
    expect((await runCron()).body.postings).toEqual({ checked: 1, stillOpen: 0, missing: 1, errors: 0 });
    expect((await agent.get(`/api/applications/${a.id}/snapshot`)).body.postingStatus).toBe('open');

    // Checked again too soon: skipped.
    expect((await runCron()).body.postings.checked).toBe(0);

    await age();
    await runCron();
    const snap = (await agent.get(`/api/applications/${a.id}/snapshot`)).body;
    expect(snap).toMatchObject({ postingStatus: 'closed', title: 'Software Engineer, New Grad' });
    expect(snap.closedAt).toEqual(expect.any(String));
    // The saved description is still there after the posting is gone.
    expect(snap.description).toContain('Build & ship.');
  });

  it('resets the miss count if the posting comes back, and ignores network errors', async () => {
    const a = await createApp_({ link: 'https://boards.greenhouse.io/stripe/jobs/8172487' });
    await agent.post(`/api/applications/${a.id}/snapshot`).expect(200);
    const ok = responses.get(GH_URL)!;
    responses.delete(GH_URL);
    await age();
    await runCron();
    responses.set(GH_URL, () => { throw new TypeError('network down'); });
    await age();
    expect((await runCron()).body.postings).toMatchObject({ errors: 1 });
    responses.set(GH_URL, ok);
    await age();
    await runCron();
    responses.delete(GH_URL);
    await age();
    await runCron();
    expect((await agent.get(`/api/applications/${a.id}/snapshot`)).body.postingStatus).toBe('open');
  });

  it('skips pasted descriptions, closed applications and demo accounts', async () => {
    const pasted = await createApp_({ link: 'https://boards.greenhouse.io/stripe/jobs/8172487' });
    await agent.put(`/api/applications/${pasted.id}/snapshot`).send({ description: 'x' }).expect(200);
    const rejected = await createApp_({ link: 'https://boards.greenhouse.io/stripe/jobs/8172487', status: 'rejected' });
    await agent.post(`/api/applications/${rejected.id}/snapshot`).expect(200);
    const demo = request.agent(app).set('X-Requested-With', 'fetch');
    await demo.post('/api/auth/demo').expect(201);
    await age();
    calls.length = 0;
    expect((await runCron()).body.postings.checked).toBe(0);
    expect(calls).toEqual([]);
  });

  it('gives demo sandboxes a saved posting and a closed one', async () => {
    const demo = request.agent(app).set('X-Requested-With', 'fetch');
    await demo.post('/api/auth/demo').expect(201);
    const status = (await demo.get('/api/job-postings/status').expect(200)).body;
    expect(status.map((s: { postingStatus: string }) => s.postingStatus).sort()).toEqual(['closed', 'unknown']);
  });
});
