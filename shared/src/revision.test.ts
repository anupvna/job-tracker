import { describe, expect, it } from 'vitest';
import { afterReview, dueReviews, firstReview, MASTERED_STAGE } from './revision.js';
import { computeStreaks, daysUntil, weekBounds, activityQuerySchema, prepGoalsSchema } from './momentum.js';

describe('spaced repetition', () => {
  it('schedules the first review 1 day out, or 3 if it was easy', () => {
    expect(firstReview('ok', '2026-10-09')).toEqual({ stage: 0, nextReviewOn: '2026-10-10' });
    expect(firstReview('hard', '2026-10-09')).toEqual({ stage: 0, nextReviewOn: '2026-10-10' });
    expect(firstReview('easy', '2026-10-09')).toEqual({ stage: 1, nextReviewOn: '2026-10-12' });
  });

  it('walks 1 → 3 → 7 → 14 → 30 days with OK reviews, then masters it', () => {
    let state = firstReview('ok', '2026-10-01');
    const gaps: number[] = [];
    let day = '2026-10-01';
    while (state.nextReviewOn) {
      gaps.push(daysUntil(day, state.nextReviewOn));
      day = state.nextReviewOn;
      state = afterReview(state.stage, 'ok', day);
    }
    expect(gaps).toEqual([1, 3, 7, 14, 30]);
    expect(state).toEqual({ stage: MASTERED_STAGE, nextReviewOn: null });
  });

  it('resets on Hard and skips a step on Easy', () => {
    expect(afterReview(3, 'hard', '2026-10-09')).toEqual({ stage: 0, nextReviewOn: '2026-10-10' });
    expect(afterReview(1, 'easy', '2026-10-09')).toEqual({ stage: 3, nextReviewOn: '2026-10-23' });
    expect(afterReview(4, 'easy', '2026-10-09')).toEqual({ stage: MASTERED_STAGE, nextReviewOn: null });
  });

  it('lists due reviews most overdue first, then in roadmap order', () => {
    const p = [
      { slug: 'b', nextReviewOn: '2026-10-09' },
      { slug: 'a', nextReviewOn: '2026-10-09' },
      { slug: 'c', nextReviewOn: '2026-10-02' },
      { slug: 'd', nextReviewOn: '2026-10-10' }, // not due yet
      { slug: 'e', nextReviewOn: null }, // mastered
    ];
    expect(dueReviews(p, '2026-10-09', ['a', 'b', 'c']).map((x) => x.slug)).toEqual(['c', 'a', 'b']);
  });
});

describe('momentum', () => {
  const days = (...d: string[]) => new Set(d);

  it('counts the current streak through today, or through yesterday if today is empty', () => {
    expect(computeStreaks(days('2026-10-07', '2026-10-08', '2026-10-09'), '2026-10-09')).toEqual({
      current: 3, longest: 3, activeToday: true,
    });
    expect(computeStreaks(days('2026-10-07', '2026-10-08'), '2026-10-09')).toEqual({
      current: 2, longest: 2, activeToday: false,
    });
    expect(computeStreaks(days('2026-10-06'), '2026-10-09').current).toBe(0);
  });

  it('finds the longest run anywhere', () => {
    const s = computeStreaks(days('2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-10-09'), '2026-10-09');
    expect(s).toEqual({ current: 1, longest: 4, activeToday: true });
    expect(computeStreaks(days(), '2026-10-09')).toEqual({ current: 0, longest: 0, activeToday: false });
  });

  it('computes Monday–Sunday weeks', () => {
    expect(weekBounds('2026-10-09')).toEqual({ start: '2026-10-05', end: '2026-10-11' }); // Fri
    expect(weekBounds('2026-10-11')).toEqual({ start: '2026-10-05', end: '2026-10-11' }); // Sun
    expect(weekBounds('2026-10-12')).toEqual({ start: '2026-10-12', end: '2026-10-18' }); // Mon
  });

  it('counts days to the goal', () => {
    expect(daysUntil('2026-10-09', '2027-05-01')).toBe(204);
    expect(daysUntil('2027-05-02', '2027-05-01')).toBe(-1);
  });

  it('validates activity ranges and goals', () => {
    expect(activityQuerySchema.safeParse({ from: '2026-01-01', to: '2026-10-09' }).success).toBe(true);
    expect(activityQuerySchema.safeParse({ from: '2026-10-10', to: '2026-10-09' }).success).toBe(false);
    expect(activityQuerySchema.safeParse({ from: '2024-01-01', to: '2026-10-09' }).success).toBe(false);
    expect(prepGoalsSchema.parse({ targetDate: '2027-05-01', weeklyProblems: 15, weeklyApplications: 10 }).weeklyReferrals).toBe(3);
    expect(prepGoalsSchema.safeParse({ targetDate: '2027-05-01', weeklyProblems: -1, weeklyApplications: 10 }).success).toBe(false);
  });
});
