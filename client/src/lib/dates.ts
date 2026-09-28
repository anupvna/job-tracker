import { daysBetween } from '@job-tracker/shared';

/** Today as YYYY-MM-DD in the user's local timezone. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

const shortFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const longFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** "Sep 28", or "Sep 28, 2025" when not in the current year. */
export function formatDate(iso: string | null, today = todayISO()): string {
  if (!iso) return '—';
  const date = new Date(`${iso}T00:00:00`);
  return iso.slice(0, 4) === today.slice(0, 4) ? shortFmt.format(date) : longFmt.format(date);
}

/** "Today", "Tomorrow", "in 5 days", "3 days overdue". */
export function relativeFollowUp(iso: string, today = todayISO()): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return '1 day overdue';
  if (diff < 0) return `${-diff} days overdue`;
  return `in ${diff} days`;
}

/** "just now", "5m ago", "3h ago", "2d ago", or a date. */
export function timeAgo(isoTimestamp: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(isoTimestamp)) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(todayISO(new Date(isoTimestamp)));
}
