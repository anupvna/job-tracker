import type { ScheduleResult } from '@job-tracker/shared';
import { cn } from '../../lib/cn';
import { formatDate } from '../../lib/dates';

/** "On track" / "4 behind" / "2 ahead" / "Starts Oct 12" / "Completed". */
export function PlanStatus({ schedule, startDate, today }: { schedule: ScheduleResult; startDate: string; today: string }) {
  let label: string;
  let tone: 'good' | 'warn' | 'neutral';
  if (schedule.completed) [label, tone] = ['Completed', 'good'];
  else if (!schedule.started) [label, tone] = [`Starts ${formatDate(startDate, today)}`, 'neutral'];
  else if (schedule.delta < 0) [label, tone] = [`${-schedule.delta} behind`, 'warn'];
  else if (schedule.delta > 0) [label, tone] = [`${schedule.delta} ahead`, 'good'];
  else [label, tone] = ['On track', 'good'];

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium ring-1',
        tone === 'good' && 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        tone === 'warn' && 'bg-amber-50 text-amber-800 ring-amber-200',
        tone === 'neutral' && 'bg-zinc-100 text-zinc-600 ring-zinc-200',
      )}
    >
      {label}
    </span>
  );
}

export function ProgressBar({ value, total, className }: { value: number; total: number; className?: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      aria-label={`${value} of ${total} solved`}
      className={cn('h-1.5 overflow-hidden rounded-full bg-zinc-200', className)}
    >
      <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}
