import { z } from 'zod';
import { addDaysISO } from './quickAdd.js';

/*
 * Momentum: daily streaks, a GitHub-style activity heatmap, a countdown to the job-search
 * goal date and weekly targets. All pure functions over ISO calendar dates.
 */

const isoDate = z.iso.date({ message: 'Use a valid date (YYYY-MM-DD)' });

export const GOAL_LIMITS = { weeklyProblems: 100, weeklyApplications: 200 } as const;

export const DEFAULT_GOALS = {
  targetDate: '2027-05-01',
  weeklyProblems: 15,
  weeklyApplications: 10,
} as const;

/** PUT /api/goals */
export const prepGoalsSchema = z.object({
  targetDate: isoDate,
  weeklyProblems: z.number().int().min(0).max(GOAL_LIMITS.weeklyProblems),
  weeklyApplications: z.number().int().min(0).max(GOAL_LIMITS.weeklyApplications),
});

export type PrepGoalsInput = z.input<typeof prepGoalsSchema>;

export interface PrepGoals {
  targetDate: string;
  weeklyProblems: number;
  weeklyApplications: number;
  /** True when the user hasn't saved goals yet and these are the defaults. */
  isDefault: boolean;
}

/** Longest range the activity endpoint will return, in days. */
export const ACTIVITY_MAX_DAYS = 400;

/** GET /api/activity?from&to */
export const activityQuerySchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((q) => q.from <= q.to, { message: '`from` must not be after `to`' })
  .refine(
    (q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= ACTIVITY_MAX_DAYS,
    { message: `Range can be at most ${ACTIVITY_MAX_DAYS} days` },
  );

export interface ActivityDay {
  day: string;
  solves: number;
  reviews: number;
}

export interface Streaks {
  /** Consecutive active days ending today (or yesterday, if today has nothing yet). */
  current: number;
  longest: number;
  activeToday: boolean;
}

/** Streaks from the set of days with any activity. */
export function computeStreaks(activeDays: ReadonlySet<string>, today: string): Streaks {
  const activeToday = activeDays.has(today);
  let current = 0;
  let cursor = activeToday ? today : addDaysISO(today, -1);
  while (activeDays.has(cursor)) {
    current++;
    cursor = addDaysISO(cursor, -1);
  }

  let longest = 0;
  for (const day of activeDays) {
    if (activeDays.has(addDaysISO(day, -1))) continue; // not the start of a run
    let run = 1;
    while (activeDays.has(addDaysISO(day, run))) run++;
    longest = Math.max(longest, run);
  }
  return { current, longest: Math.max(longest, current), activeToday };
}

/** Monday and Sunday of the week containing `today`. */
export function weekBounds(today: string): { start: string; end: string } {
  const wd = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sun
  const start = addDaysISO(today, -((wd + 6) % 7));
  return { start, end: addDaysISO(start, 6) };
}

/** Whole days from today until the goal (negative once it has passed). */
export function daysUntil(today: string, target: string): number {
  return Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
