import {
  afterReview,
  firstReview,
  type ProblemProgress,
  type ReviewRating,
} from '@job-tracker/shared';
import { HttpError } from '../../lib/httpError.js';
import type { StudyPlansRepository } from './studyPlans.repository.js';

/** Solving and revising problems: the spaced-repetition rules live here, not in SQL. */
export class ProgressService {
  constructor(private readonly repo: StudyPlansRepository) {}

  /**
   * Mark solved. Re-marking keeps the original solved date; passing a rating for a problem
   * that hasn't been reviewed yet re-plans its first review.
   */
  async solve(
    userId: string,
    slug: string,
    solvedOn: string,
    rating?: ReviewRating,
  ): Promise<ProblemProgress> {
    const existing = await this.repo.findProgress(userId, slug);
    if (!existing) {
      const r = rating ?? 'ok';
      return this.repo.insertSolved(userId, slug, solvedOn, r, firstReview(r, solvedOn));
    }
    if (rating && existing.reviewCount === 0 && rating !== existing.rating) {
      return (await this.repo.rerate(userId, slug, rating, firstReview(rating, existing.solvedOn))) ?? existing;
    }
    return existing;
  }

  async review(
    userId: string,
    slug: string,
    rating: ReviewRating,
    reviewedOn: string,
  ): Promise<ProblemProgress> {
    const existing = await this.repo.findProgress(userId, slug);
    if (!existing) throw HttpError.notFound('Solve this problem before reviewing it');
    const next = afterReview(existing.reviewStage, rating, reviewedOn);
    const updated = await this.repo.recordReview(userId, slug, rating, reviewedOn, next);
    if (!updated) throw HttpError.notFound('Solve this problem before reviewing it');
    return updated;
  }
}
