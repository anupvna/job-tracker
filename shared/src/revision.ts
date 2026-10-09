import { z } from 'zod';
import { addDaysISO } from './quickAdd.js';

/*
 * Spaced repetition for solved problems. After solving, a problem comes back for review
 * after 1, 3, 7, 14 and 30 days. Each review is rated:
 *   Hard → start over (back in 1 day)   OK → next step   Easy → skip a step
 * Passing the 30-day review marks the problem as mastered (no more reminders).
 */

export const REVIEW_RATINGS = ['hard', 'ok', 'easy'] as const;
export type ReviewRating = (typeof REVIEW_RATINGS)[number];

export const REVIEW_RATING_LABELS: Record<ReviewRating, string> = {
  hard: 'Hard',
  ok: 'OK',
  easy: 'Easy',
};

/** Days until the next review, indexed by stage. */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;
export const MASTERED_STAGE = REVIEW_INTERVALS.length;

/** Most reviews shown per day, so a backlog never turns into a wall of red. */
export const DAILY_REVIEW_LIMIT = 5;

export interface ReviewState {
  stage: number;
  /** null once mastered. */
  nextReviewOn: string | null;
}

/** Schedule the first review right after solving. Easy problems skip the 1-day check. */
export function firstReview(rating: ReviewRating, solvedOn: string): ReviewState {
  const stage = rating === 'easy' ? 1 : 0;
  return { stage, nextReviewOn: addDaysISO(solvedOn, REVIEW_INTERVALS[stage]!) };
}

/** Move a problem along after a review. */
export function afterReview(stage: number, rating: ReviewRating, reviewedOn: string): ReviewState {
  const next = rating === 'hard' ? 0 : Math.min(stage + (rating === 'easy' ? 2 : 1), MASTERED_STAGE);
  if (next >= MASTERED_STAGE) return { stage: MASTERED_STAGE, nextReviewOn: null };
  return { stage: next, nextReviewOn: addDaysISO(reviewedOn, REVIEW_INTERVALS[next]!) };
}

const isoDate = z.iso.date({ message: 'Use a valid date (YYYY-MM-DD)' });

/** POST /api/progress/:slug/review */
export const reviewInputSchema = z.object({
  rating: z.enum(REVIEW_RATINGS),
  reviewedOn: isoDate,
});

/** Due reviews, most overdue first (ties keep `order`, i.e. roadmap order). */
export function dueReviews<T extends { slug: string; nextReviewOn: string | null }>(
  progress: readonly T[],
  today: string,
  order: readonly string[],
): T[] {
  const rank = new Map(order.map((slug, i) => [slug, i]));
  return progress
    .filter((p): p is T & { nextReviewOn: string } => p.nextReviewOn !== null && p.nextReviewOn <= today)
    .sort(
      (a, b) =>
        a.nextReviewOn.localeCompare(b.nextReviewOn) ||
        (rank.get(a.slug) ?? 999) - (rank.get(b.slug) ?? 999),
    );
}
