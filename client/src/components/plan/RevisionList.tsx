import {
  DAILY_REVIEW_LIMIT,
  NEETCODE_150,
  REVIEW_INTERVALS,
  daysBetween,
  dueReviews,
  leetcodeUrl,
  type ProblemProgress,
  type ReviewRating,
} from '@job-tracker/shared';
import { ExternalLink, History } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useReviewProblem } from '../../hooks/useStudyPlan';
import { DifficultyPill, RatingChips } from './ProblemRow';

const BY_SLUG = new Map(NEETCODE_150.map((p) => [p.slug, p]));
const ORDER = NEETCODE_150.map((p) => p.slug);

/** "1 day", "3 days", "1 week", "2 weeks", "30 days". */
export function durationPhrase(days: number) {
  if (days % 7 === 0 && days >= 7) return `${days / 7} week${days === 7 ? '' : 's'}`;
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** "It's been 7 days since you solved Two Sum — revise it." with Hard / OK / Easy to log it. */
export function RevisionList({ progress, today }: { progress: ReadonlyMap<string, ProblemProgress>; today: string }) {
  const review = useReviewProblem();
  const [showAll, setShowAll] = useState(false);
  const due = dueReviews([...progress.values()], today, ORDER);
  if (due.length === 0) return null;
  const shown = showAll ? due : due.slice(0, DAILY_REVIEW_LIMIT);

  function onPick(p: ProblemProgress, rating: ReviewRating) {
    const title = BY_SLUG.get(p.slug)?.title ?? p.slug;
    review.mutate(
      { slug: p.slug, rating },
      {
        onSuccess: (updated) => {
          const days = updated.nextReviewOn ? daysBetween(today, updated.nextReviewOn) : null;
          toast.success(
            days === null ? `${title} mastered — no more reminders` : `${title}: next review in ${days} day${days === 1 ? '' : 's'}`,
          );
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <section aria-labelledby="revision-title" className="border-t border-zinc-100">
      <h3
        id="revision-title"
        className="flex items-center justify-between bg-zinc-50 px-4 py-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase sm:px-5"
      >
        <span className="flex items-center gap-1.5">
          <History className="size-3.5" aria-hidden />
          Revision
        </span>
        <span className="tabular-nums text-violet-700">{due.length} due</span>
      </h3>
      <ul className="divide-y divide-zinc-100">
        {shown.map((p) => {
          const problem = BY_SLUG.get(p.slug);
          if (!problem) return null;
          const last = p.lastReviewedOn ?? p.solvedOn;
          const verb = p.lastReviewedOn ? 'revised' : 'solved';
          const gap = daysBetween(last, today);
          return (
            <li key={p.slug} className="px-4 py-3 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-900">
                    It’s been {durationPhrase(Math.max(gap, 1))} since you {verb}{' '}
                    <a
                      href={leetcodeUrl(problem.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      {problem.title}
                    </a>{' '}
                    — revise it.
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <DifficultyPill difficulty={problem.difficulty} />
                    <span>{problem.topic}</span>
                    <span>· review {p.reviewCount + 1} of {REVIEW_INTERVALS.length}</span>
                    {p.nextReviewOn! < today && <span className="text-amber-700">· due since {daysBetween(p.nextReviewOn!, today)}d</span>}
                  </div>
                  <RatingChips
                    label="After revising, how was it?"
                    onPick={(r) => onPick(p, r)}
                    disabled={review.isPending}
                  />
                </div>
                <a
                  href={leetcodeUrl(problem.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${problem.title} on LeetCode`}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </li>
          );
        })}
      </ul>
      {due.length > DAILY_REVIEW_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full border-t border-zinc-100 px-4 py-2 text-left text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 sm:px-5"
        >
          {showAll ? 'Show fewer' : `Show all ${due.length} (we suggest ${DAILY_REVIEW_LIMIT} a day)`}
        </button>
      )}
    </section>
  );
}
