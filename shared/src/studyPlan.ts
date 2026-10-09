import { z } from 'zod';
import { NEETCODE_150_SLUGS, type Problem } from './neetcode150.js';
import { addDaysISO } from './quickAdd.js';
import { REVIEW_RATINGS, type ReviewRating } from './revision.js';

/*
 * Study plans: pick a pace and the days you study, and the plan lays the problem list out
 * day by day. Nothing is stored per day — the schedule is recomputed from "what's left" every
 * time, which is exactly what makes it adapt: miss a day and the remaining work simply flows
 * onto the next study days instead of piling up as overdue.
 */

export const PLAN_KEYS = ['neetcode150'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export const STUDY_PACES = ['low', 'medium', 'high'] as const;
export type StudyPace = (typeof STUDY_PACES)[number];

/** New problems per study day. */
export const PACE_PER_DAY: Record<StudyPace, number> = { low: 2, medium: 3, high: 5 };

/** Weekdays (0 = Sunday … 6 = Saturday) suggested for each pace. */
export const DEFAULT_STUDY_DAYS: Record<StudyPace, number[]> = {
  low: [1, 2, 3, 4, 5],
  medium: [1, 2, 3, 4, 5, 6],
  high: [1, 2, 3, 4, 5, 6],
};

export const PACE_LABELS: Record<StudyPace, string> = { low: 'Low', medium: 'Medium', high: 'High' };

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const isoDate = z.iso.date({ message: 'Use a valid date (YYYY-MM-DD)' });

/** PUT /api/study-plans/:planKey */
export const studyPlanInputSchema = z.object({
  pace: z.enum(STUDY_PACES),
  studyDays: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'Pick at least one study day')
    .max(7)
    .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  startDate: isoDate,
});

export const planKeyParamSchema = z.object({ planKey: z.enum(PLAN_KEYS) });

/** PUT /api/progress/:slug — mark a problem solved (on the user's local date) or unsolved. */
export const progressInputSchema = z.object({
  solved: z.boolean(),
  solvedOn: isoDate,
  /** How it felt. Sets when the first review comes back; defaults to OK. */
  rating: z.enum(REVIEW_RATINGS).optional(),
});

export const problemSlugParamSchema = z.object({
  slug: z
    .string()
    .max(100)
    .refine((s) => NEETCODE_150_SLUGS.has(s), { message: 'Unknown problem' }),
});

export type StudyPlanInput = z.input<typeof studyPlanInputSchema>;

export interface StudyPlan {
  planKey: PlanKey;
  pace: StudyPace;
  studyDays: number[];
  startDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProblemProgress {
  slug: string;
  /** The user's local calendar date when it was marked solved. */
  solvedOn: string;
  /** Rating given when solved (null for problems solved before ratings existed). */
  rating: ReviewRating | null;
  /** Spaced-repetition step: 0–4 active, 5 = mastered. */
  reviewStage: number;
  /** When it's next due for revision; null once mastered. */
  nextReviewOn: string | null;
  lastReviewedOn: string | null;
  reviewCount: number;
}

export interface StudyPlanState {
  plan: StudyPlan | null;
  progress: ProblemProgress[];
}

// ---------------------------------------------------------------------------------------

export function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/** Number of study days in [from, to], inclusive. 0 when to < from. */
export function countStudyDays(from: string, to: string, studyDays: readonly number[]): number {
  if (to < from) return 0;
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  const full = Math.floor(days / 7);
  let count = full * studyDays.length;
  const startWd = weekdayOf(from);
  for (let i = 0; i < days % 7; i++) if (studyDays.includes((startWd + i) % 7)) count++;
  return count;
}

/** First study day on or after `iso`. */
export function nextStudyDay(iso: string, studyDays: readonly number[]): string {
  let d = iso;
  for (let i = 0; i < 7 && !studyDays.includes(weekdayOf(d)); i++) d = addDaysISO(d, 1);
  return d;
}

export interface ScheduleInput {
  problems: readonly Problem[];
  /** slug → solvedOn (YYYY-MM-DD). */
  solved: ReadonlyMap<string, string>;
  pace: StudyPace;
  studyDays: readonly number[];
  startDate: string;
  today: string;
  /** How many upcoming study days to list. */
  upcomingDays?: number;
}

export interface ScheduleDay {
  date: string;
  /** 1-based study-day number since the plan started. */
  dayNumber: number;
  problems: Problem[];
}

export interface ScheduleResult {
  perDay: number;
  total: number;
  solvedCount: number;
  started: boolean;
  completed: boolean;
  /** Today's list: problems already solved today first, then what's left for today. */
  today: { dayNumber: number; items: { problem: Problem; solved: boolean }[] } | null;
  upcoming: ScheduleDay[];
  /** Date of the last study day needed at this pace; null once everything is solved. */
  projectedFinish: string | null;
  /** Finish date if every study day since the start had been kept. */
  plannedFinish: string;
  /**
   * Problems solved since the plan started (before today) minus problems scheduled before today.
   * Negative = behind. Work done before the start date doesn't count, so restarting a plan
   * doesn't make you look "ahead".
   */
  delta: number;
}

/** Date of the n-th study day (1-based) counting from `start`. */
function nthStudyDay(start: string, n: number, studyDays: readonly number[]): string {
  let d = nextStudyDay(start, studyDays);
  for (let i = 1; i < n; i++) d = nextStudyDay(addDaysISO(d, 1), studyDays);
  return d;
}

export function buildSchedule(input: ScheduleInput): ScheduleResult {
  const { problems, solved, pace, studyDays, startDate, today } = input;
  const perDay = PACE_PER_DAY[pace];
  const total = problems.length;
  const isSolved = (p: Problem) => solved.has(p.slug);
  const solvedCount = problems.filter(isSolved).length;
  const started = today >= startDate;

  const solvedToday = problems.filter((p) => solved.get(p.slug) === today);
  let queue = problems.filter((p) => !isSolved(p));

  let todayBlock: ScheduleResult['today'] = null;
  if (started && studyDays.includes(weekdayOf(today))) {
    const quota = Math.max(0, perDay - solvedToday.length);
    const fresh = queue.slice(0, quota);
    queue = queue.slice(quota);
    todayBlock = {
      dayNumber: countStudyDays(startDate, today, studyDays),
      items: [
        ...solvedToday.map((problem) => ({ problem, solved: true })),
        ...fresh.map((problem) => ({ problem, solved: false })),
      ],
    };
  }

  // Lay the rest out over the following study days.
  const upcoming: ScheduleDay[] = [];
  const limit = input.upcomingDays ?? 7;
  let projectedFinish: string | null = null;
  if (todayBlock?.items.some((i) => !i.solved)) projectedFinish = today;
  let cursor = started ? addDaysISO(today, 1) : startDate;
  let dayNumber = countStudyDays(startDate, addDaysISO(cursor, -1), studyDays);
  while (queue.length > 0) {
    cursor = nextStudyDay(cursor, studyDays);
    dayNumber += 1;
    const batch = queue.slice(0, perDay);
    queue = queue.slice(perDay);
    if (upcoming.length < limit) upcoming.push({ date: cursor, dayNumber, problems: batch });
    projectedFinish = cursor;
    cursor = addDaysISO(cursor, 1);
  }

  const daysBeforeToday = started ? countStudyDays(startDate, addDaysISO(today, -1), studyDays) : 0;
  const expected = Math.min(total, perDay * daysBeforeToday);
  let doneSinceStart = 0;
  for (const p of problems) {
    const on = solved.get(p.slug);
    if (on !== undefined && on >= startDate && on < today) doneSinceStart++;
  }
  const delta = doneSinceStart - expected;

  return {
    perDay,
    total,
    solvedCount,
    started,
    completed: solvedCount === total,
    today: todayBlock,
    upcoming,
    projectedFinish,
    plannedFinish: nthStudyDay(startDate, Math.ceil(total / perDay), studyDays),
    delta,
  };
}
