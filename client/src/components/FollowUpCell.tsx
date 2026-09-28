import { getFollowUpState, type Application } from '@job-tracker/shared';
import { CircleAlert, CalendarClock } from 'lucide-react';
import { cn } from '../lib/cn';
import { formatDate, relativeFollowUp } from '../lib/dates';

export function FollowUpCell({ app, today }: { app: Application; today: string }) {
  if (!app.followUpDate) return <span className="text-zinc-400">—</span>;

  const state = getFollowUpState(app, today);
  const closed = state === 'none';

  return (
    <div className="leading-tight">
      <div
        className={cn(
          'flex items-center gap-1.5 text-sm',
          state === 'overdue' && 'font-medium text-red-700',
          state === 'today' && 'font-medium text-amber-700',
          state === 'upcoming' && 'text-zinc-800',
          closed && 'text-zinc-400 line-through decoration-zinc-300',
        )}
      >
        {state === 'overdue' && <CircleAlert className="size-3.5" aria-hidden />}
        {state === 'today' && <CalendarClock className="size-3.5" aria-hidden />}
        {formatDate(app.followUpDate, today)}
      </div>
      {!closed && (
        <div
          className={cn(
            'mt-0.5 text-xs',
            state === 'overdue'
              ? 'text-red-600'
              : state === 'today'
                ? 'text-amber-600'
                : 'text-zinc-500',
          )}
        >
          {relativeFollowUp(app.followUpDate, today)}
        </div>
      )}
    </div>
  );
}
