import { CLOSED_STATUSES, type ApplicationStatus } from './constants.js';

export type FollowUpState = 'none' | 'overdue' | 'today' | 'upcoming';

/**
 * Classify a follow-up date relative to `today`. Dates are ISO calendar strings
 * (YYYY-MM-DD), so lexical comparison is chronological and timezone-free.
 * Closed applications (offer / rejected) never count as overdue.
 */
export function getFollowUpState(
  app: { followUpDate: string | null; status: ApplicationStatus },
  today: string,
): FollowUpState {
  if (!app.followUpDate || CLOSED_STATUSES.includes(app.status)) return 'none';
  if (app.followUpDate < today) return 'overdue';
  if (app.followUpDate === today) return 'today';
  return 'upcoming';
}

export function isOverdue(
  app: { followUpDate: string | null; status: ApplicationStatus },
  today: string,
): boolean {
  return getFollowUpState(app, today) === 'overdue';
}

/** Whole days between two ISO dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
