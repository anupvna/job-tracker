import {
  computeStreaks,
  daysUntil,
  weekBounds,
  type PrepGoalsInput,
} from '@job-tracker/shared';
import { CalendarClock, Flame, Settings2, Target } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useApplicationsList } from '../../hooks/useApplications';
import { useActivity, useGoals, useSaveGoals, useStudyPlan } from '../../hooks/useStudyPlan';
import { cn } from '../../lib/cn';
import { addDays, formatDate, todayISO } from '../../lib/dates';
import { IconButton } from '../ui/Button';
import { Modal } from '../ui/Dialog';
import { GoalsEditor } from './GoalsEditor';
import { Heatmap } from './Heatmap';

// Same filters as the Applications tab's default view, so the cached list is shared.
const APP_FILTERS = { sort: 'followUpDate', order: 'asc' } as const;

/** Streak, goal countdown, this week's targets and the activity heatmap. */
export function MomentumCard() {
  const today = todayISO();
  const activity = useActivity();
  const goals = useGoals();
  const saveGoals = useSaveGoals();
  const { progress, schedule } = useStudyPlan();
  const apps = useApplicationsList(APP_FILTERS);
  const [editing, setEditing] = useState(false);

  const days = useMemo(() => activity.data ?? [], [activity.data]);
  const streaks = useMemo(() => computeStreaks(new Set(days.map((d) => d.day)), today), [days, today]);
  const week = weekBounds(today);
  const inWeek = (d: string | null) => d !== null && d >= week.start && d <= week.end;
  const solvedThisWeek = [...progress.values()].filter((p) => inWeek(p.solvedOn)).length;
  const appliedThisWeek = (apps.data ?? []).filter((a) => a.status !== 'wishlist' && inWeek(a.appliedDate)).length;

  const g = goals.data;
  const left = g ? daysUntil(today, g.targetDate) : null;
  const heatmapFrom = addDays(week.start, -25 * 7);

  async function onSaveGoals(input: PrepGoalsInput) {
    try {
      await saveGoals.mutateAsync(input);
      toast.success('Goals saved');
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save goals');
    }
  }

  return (
    <section aria-label="Momentum" className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
      <div className="grid grid-cols-2 gap-px bg-zinc-100 sm:grid-cols-3">
        <Tile
          icon={<Flame className={cn('size-4', streaks.activeToday ? 'text-orange-500' : 'text-zinc-400')} aria-hidden />}
          label="Streak"
        >
          <div className="text-2xl font-semibold tabular-nums">
            {streaks.current} <span className="text-sm font-normal text-zinc-500">day{streaks.current === 1 ? '' : 's'}</span>
          </div>
          <p className="text-xs text-zinc-500">
            {streaks.activeToday
              ? `Done for today · longest ${streaks.longest}`
              : streaks.current > 0
                ? 'Solve or revise one problem today to keep it going'
                : 'Solve or revise a problem to start a streak'}
          </p>
        </Tile>

        <Tile
          icon={<CalendarClock className="size-4 text-violet-600" aria-hidden />}
          label="Goal"
          action={
            <IconButton aria-label="Edit goals" onClick={() => setEditing(true)} className="size-7">
              <Settings2 className="size-3.5" />
            </IconButton>
          }
        >
          {g && left !== null ? (
            <>
              <div className="text-2xl font-semibold tabular-nums">
                {left >= 0 ? left : 0} <span className="text-sm font-normal text-zinc-500">days left</span>
              </div>
              <p className="text-xs text-zinc-500">
                until {formatDate(g.targetDate, today)}
                {schedule?.projectedFinish && (
                  <>
                    {' '}· NeetCode done ~{formatDate(schedule.projectedFinish, today)}
                    {schedule.projectedFinish > g.targetDate && <span className="font-medium text-amber-700"> (after your goal)</span>}
                  </>
                )}
              </p>
            </>
          ) : (
            <div className="h-10 animate-pulse rounded bg-zinc-100" />
          )}
        </Tile>

        <Tile icon={<Target className="size-4 text-emerald-600" aria-hidden />} label="This week" className="col-span-2 sm:col-span-1">
          {g ? (
            <div className="space-y-2">
              <Meter label="Problems" value={solvedThisWeek} target={g.weeklyProblems} />
              <Meter label="Applications" value={appliedThisWeek} target={g.weeklyApplications} />
            </div>
          ) : (
            <div className="h-10 animate-pulse rounded bg-zinc-100" />
          )}
        </Tile>
      </div>

      <div className="border-t border-zinc-100 px-4 py-4 sm:px-5">
        {activity.isPending ? (
          <div className="h-28 animate-pulse rounded bg-zinc-50" aria-busy="true" aria-label="Loading activity" />
        ) : (
          <Heatmap days={days} from={heatmapFrom} today={today} />
        )}
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} labelledBy="goals-title">
        {editing && g && <GoalsEditor goals={g} onSave={onSaveGoals} onCancel={() => setEditing(false)} />}
      </Modal>
    </section>
  );
}

function Tile({
  icon,
  label,
  action,
  className,
  children,
}: {
  icon: ReactNode;
  label: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1 bg-white px-4 py-3.5 sm:px-5', className)}>
      <div className="flex h-7 items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          {icon}
          {label}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

function Meter({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 100;
  const met = target > 0 && value >= target;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-zinc-600">{label}</span>
        <span className={cn('font-medium tabular-nums', met ? 'text-emerald-700' : 'text-zinc-800')}>
          {value}/{target}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} this week`}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={value}
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200"
      >
        <div className={cn('h-full rounded-full', met ? 'bg-emerald-500' : 'bg-zinc-800')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
