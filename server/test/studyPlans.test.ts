import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NEETCODE_150 } from '@job-tracker/shared';
import { migrate } from '../src/db/migrate.js';
import { client, db, resetDb, signedInClient, type Client } from './helpers.js';

let agent: Client;
const PLAN = { pace: 'medium', studyDays: [6, 1, 2, 3, 4, 5, 1], startDate: '2026-10-12' };
const TWO_SUM = 'two-sum';

beforeAll(async () => {
  await migrate(db);
});

beforeEach(async () => {
  await resetDb();
  agent = await signedInClient();
});

afterAll(async () => {
  await db.end();
});

describe('study plans API', () => {
  it('requires a session', async () => {
    await client().get('/api/study-plans/neetcode150').expect(401);
    await client().put(`/api/progress/${TWO_SUM}`).send({ solved: true, solvedOn: '2026-10-12' }).expect(401);
  });

  it('starts with no plan and no progress', async () => {
    const res = await agent.get('/api/study-plans/neetcode150').expect(200);
    expect(res.body).toEqual({ plan: null, progress: [] });
  });

  it('creates and then updates a plan (normalizing study days)', async () => {
    const created = await agent.put('/api/study-plans/neetcode150').send(PLAN).expect(200);
    expect(created.body).toMatchObject({
      planKey: 'neetcode150',
      pace: 'medium',
      studyDays: [1, 2, 3, 4, 5, 6],
      startDate: '2026-10-12',
    });
    const updated = await agent
      .put('/api/study-plans/neetcode150')
      .send({ ...PLAN, pace: 'high', studyDays: [0, 6] })
      .expect(200);
    expect(updated.body).toMatchObject({ pace: 'high', studyDays: [0, 6] });
    const state = await agent.get('/api/study-plans/neetcode150').expect(200);
    expect(state.body.plan.pace).toBe('high');
  });

  it('rejects unknown plans, bad pace and empty study days', async () => {
    await agent.get('/api/study-plans/blind999').expect(400);
    await agent.put('/api/study-plans/neetcode150').send({ ...PLAN, pace: 'turbo' }).expect(400);
    await agent.put('/api/study-plans/neetcode150').send({ ...PLAN, studyDays: [] }).expect(400);
    await agent.put('/api/study-plans/neetcode150').send({ ...PLAN, studyDays: [7] }).expect(400);
  });

  it('marks problems solved and unsolved, keeping the first solved date', async () => {
    await agent.put(`/api/progress/${TWO_SUM}`).send({ solved: true, solvedOn: '2026-10-12' }).expect(200);
    const again = await agent
      .put(`/api/progress/${TWO_SUM}`)
      .send({ solved: true, solvedOn: '2026-10-14' })
      .expect(200);
    expect(again.body).toMatchObject({ slug: TWO_SUM, solvedOn: '2026-10-12' });

    let state = await agent.get('/api/study-plans/neetcode150').expect(200);
    expect(state.body.progress).toMatchObject([{ slug: TWO_SUM, solvedOn: '2026-10-12' }]);

    await agent.put(`/api/progress/${TWO_SUM}`).send({ solved: false, solvedOn: '2026-10-14' }).expect(204);
    state = await agent.get('/api/study-plans/neetcode150').expect(200);
    expect(state.body.progress).toEqual([]);
  });

  it('only accepts real NeetCode 150 slugs', async () => {
    await agent.put('/api/progress/not-a-problem').send({ solved: true, solvedOn: '2026-10-12' }).expect(400);
    await agent.put(`/api/progress/${TWO_SUM}`).send({ solved: true, solvedOn: 'yesterday' }).expect(400);
  });

  it('keeps progress when the plan is reset', async () => {
    await agent.put('/api/study-plans/neetcode150').send(PLAN).expect(200);
    await agent.put(`/api/progress/${TWO_SUM}`).send({ solved: true, solvedOn: '2026-10-12' }).expect(200);
    await agent.delete('/api/study-plans/neetcode150').expect(204);
    await agent.delete('/api/study-plans/neetcode150').expect(404);
    const state = await agent.get('/api/study-plans/neetcode150').expect(200);
    expect(state.body.plan).toBeNull();
    expect(state.body.progress).toHaveLength(1);
  });

  it("keeps each user's plan and progress private", async () => {
    await agent.put('/api/study-plans/neetcode150').send(PLAN).expect(200);
    await agent.put(`/api/progress/${TWO_SUM}`).send({ solved: true, solvedOn: '2026-10-12' }).expect(200);

    const other = await signedInClient('Other');
    const theirs = await other.get('/api/study-plans/neetcode150').expect(200);
    expect(theirs.body).toEqual({ plan: null, progress: [] });
    await other.put(`/api/progress/${TWO_SUM}`).send({ solved: false, solvedOn: '2026-10-12' }).expect(204);

    const mine = await agent.get('/api/study-plans/neetcode150').expect(200);
    expect(mine.body.progress).toHaveLength(1);
  });

  it('gives demo sandboxes a plan in progress', async () => {
    const demo = client();
    await demo.post('/api/auth/demo').expect(201);
    const res = await demo.get('/api/study-plans/neetcode150').expect(200);
    expect(res.body.plan).toMatchObject({ pace: 'medium' });
    expect(res.body.progress.length).toBeGreaterThan(10);
    const known = new Set(NEETCODE_150.map((p) => p.slug));
    expect(res.body.progress.every((p: { slug: string }) => known.has(p.slug))).toBe(true);
  });

  it('deletes plans and progress with the account', async () => {
    await agent.put('/api/study-plans/neetcode150').send(PLAN).expect(200);
    await agent.put(`/api/progress/${TWO_SUM}`).send({ solved: true, solvedOn: '2026-10-12' }).expect(200);
    await db.query('DELETE FROM users');
    const { rows } = await db.query(
      'SELECT (SELECT count(*) FROM study_plans)::int AS p, (SELECT count(*) FROM problem_progress)::int AS g',
    );
    expect(rows[0]).toEqual({ p: 0, g: 0 });
  });
});
