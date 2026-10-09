import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { client, db, resetDb, signedInClient, type Client } from './helpers.js';

let agent: Client;
const solve = (slug: string, solvedOn: string, rating?: string) =>
  agent.put(`/api/progress/${slug}`).send({ solved: true, solvedOn, ...(rating ? { rating } : {}) });
const review = (slug: string, reviewedOn: string, rating: string) =>
  agent.post(`/api/progress/${slug}/review`).send({ reviewedOn, rating });

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

describe('revision (spaced repetition)', () => {
  it('schedules the first review when a problem is solved', async () => {
    const ok = await solve('two-sum', '2026-10-09').expect(200);
    expect(ok.body).toMatchObject({ rating: 'ok', reviewStage: 0, nextReviewOn: '2026-10-10', reviewCount: 0 });
    const easy = await solve('valid-anagram', '2026-10-09', 'easy').expect(200);
    expect(easy.body).toMatchObject({ rating: 'easy', reviewStage: 1, nextReviewOn: '2026-10-12' });
  });

  it('lets you change the rating until the first review', async () => {
    await solve('two-sum', '2026-10-09').expect(200);
    const rerated = await solve('two-sum', '2026-10-11', 'hard').expect(200);
    // Keeps the original solved date; re-plans from it.
    expect(rerated.body).toMatchObject({ solvedOn: '2026-10-09', rating: 'hard', nextReviewOn: '2026-10-10' });

    await review('two-sum', '2026-10-10', 'ok').expect(200);
    const locked = await solve('two-sum', '2026-10-12', 'easy').expect(200);
    expect(locked.body).toMatchObject({ rating: 'hard', reviewCount: 1 });
  });

  it('walks the 1/3/7/14/30-day ladder and then stops reminding', async () => {
    await solve('two-sum', '2026-10-01').expect(200);
    const expected = ['2026-10-05', '2026-10-12', '2026-10-26', '2026-11-25', null];
    let day = '2026-10-02';
    for (const next of expected) {
      const res = await review('two-sum', day, 'ok').expect(200);
      expect(res.body.nextReviewOn).toBe(next);
      if (next) day = next;
    }
    const state = await agent.get('/api/study-plans/neetcode150').expect(200);
    expect(state.body.progress[0]).toMatchObject({ reviewStage: 5, nextReviewOn: null, reviewCount: 5 });
  });

  it('resets on Hard', async () => {
    await solve('two-sum', '2026-10-01', 'easy').expect(200);
    const res = await review('two-sum', '2026-10-04', 'hard').expect(200);
    expect(res.body).toMatchObject({ reviewStage: 0, nextReviewOn: '2026-10-05', lastReviewedOn: '2026-10-04' });
  });

  it('refuses to review an unsolved problem or a bad rating', async () => {
    await review('two-sum', '2026-10-04', 'ok').expect(404);
    await solve('two-sum', '2026-10-01').expect(200);
    await review('two-sum', '2026-10-04', 'meh').expect(400);
    await review('nope', '2026-10-04', 'ok').expect(400);
  });
});

describe('activity', () => {
  it('counts solves and reviews per day', async () => {
    await solve('two-sum', '2026-10-01').expect(200);
    await solve('valid-anagram', '2026-10-01').expect(200);
    await review('two-sum', '2026-10-02', 'ok').expect(200);
    const res = await agent.get('/api/activity?from=2026-09-01&to=2026-10-09').expect(200);
    expect(res.body).toEqual([
      { day: '2026-10-01', solves: 2, reviews: 0 },
      { day: '2026-10-02', solves: 0, reviews: 1 },
    ]);
  });

  it('validates the range', async () => {
    await agent.get('/api/activity?from=2026-10-09&to=2026-10-01').expect(400);
    await agent.get('/api/activity?from=2020-01-01&to=2026-10-01').expect(400);
  });
});

describe('goals', () => {
  it('returns defaults until saved, then the saved values', async () => {
    const def = await agent.get('/api/goals').expect(200);
    expect(def.body).toEqual({ targetDate: '2027-05-01', weeklyProblems: 15, weeklyApplications: 10, weeklyReferrals: 3, isDefault: true });
    const saved = await agent
      .put('/api/goals')
      .send({ targetDate: '2027-04-15', weeklyProblems: 20, weeklyApplications: 12, weeklyReferrals: 5 })
      .expect(200);
    expect(saved.body).toEqual({ targetDate: '2027-04-15', weeklyProblems: 20, weeklyApplications: 12, weeklyReferrals: 5, isDefault: false });
    await agent.put('/api/goals').send({ targetDate: '2027-04-15', weeklyProblems: 20, weeklyApplications: 12, weeklyReferrals: 500 }).expect(400);
    await agent.put('/api/goals').send({ targetDate: 'soon', weeklyProblems: 20, weeklyApplications: 12 }).expect(400);
  });
});

describe('clearing progress', () => {
  it('forgets solved problems and reviews but keeps the plan, tasks and goals', async () => {
    await agent.put('/api/study-plans/neetcode150').send({ pace: 'low', studyDays: [1], startDate: '2026-10-01' }).expect(200);
    await solve('two-sum', '2026-10-01').expect(200);
    await review('two-sum', '2026-10-02', 'ok').expect(200);
    await agent.put('/api/goals').send({ targetDate: '2027-04-15', weeklyProblems: 20, weeklyApplications: 12 }).expect(200);
    const res = await agent.delete('/api/progress').expect(200);
    expect(res.body).toEqual({ problems: 1, reviews: 1 });
    const state = await agent.get('/api/study-plans/neetcode150').expect(200);
    expect(state.body.progress).toEqual([]);
    expect(state.body.plan).not.toBeNull();
    expect((await agent.get('/api/activity?from=2026-09-01&to=2026-10-09')).body).toEqual([]);
    expect((await agent.get('/api/goals')).body.isDefault).toBe(false);
  });

  it("only clears the caller's own progress", async () => {
    await solve('two-sum', '2026-10-01').expect(200);
    const other = await signedInClient('Other');
    await other.delete('/api/progress').expect(200);
    expect((await agent.get('/api/study-plans/neetcode150')).body.progress).toHaveLength(1);
  });
});

describe('privacy and demo', () => {
  it("never shows another user's reviews, activity or goals", async () => {
    await solve('two-sum', '2026-10-01').expect(200);
    await review('two-sum', '2026-10-02', 'ok').expect(200);
    await agent.put('/api/goals').send({ targetDate: '2027-04-15', weeklyProblems: 20, weeklyApplications: 12 });

    const other = await signedInClient('Other');
    expect((await other.get('/api/activity?from=2026-09-01&to=2026-10-09').expect(200)).body).toEqual([]);
    expect((await other.get('/api/goals').expect(200)).body.isDefault).toBe(true);
    await other.post('/api/progress/two-sum/review').send({ reviewedOn: '2026-10-03', rating: 'ok' }).expect(404);
  });

  it('gives demo sandboxes revision history and some reviews due', async () => {
    const demo = client();
    await demo.post('/api/auth/demo').expect(201);
    const today = new Date().toISOString().slice(0, 10);
    const state = await demo.get('/api/study-plans/neetcode150').expect(200);
    const reviewed = state.body.progress.filter((p: { reviewCount: number }) => p.reviewCount > 0);
    expect(reviewed.length).toBeGreaterThan(5);
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const activity = await demo.get(`/api/activity?from=${from}&to=${today}`).expect(200);
    expect(activity.body.length).toBeGreaterThan(5);
  });

  it('removes reviews and goals with the account', async () => {
    await solve('two-sum', '2026-10-01').expect(200);
    await review('two-sum', '2026-10-02', 'ok').expect(200);
    await agent.put('/api/goals').send({ targetDate: '2027-04-15', weeklyProblems: 20, weeklyApplications: 12 });
    await db.query('DELETE FROM users');
    const { rows } = await db.query(
      'SELECT (SELECT count(*) FROM problem_reviews)::int AS r, (SELECT count(*) FROM prep_goals)::int AS g',
    );
    expect(rows[0]).toEqual({ r: 0, g: 0 });
  });
});
