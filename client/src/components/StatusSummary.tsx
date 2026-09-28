import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  type ApplicationStats,
  type ApplicationStatus,
} from '@job-tracker/shared';
import { TriangleAlert, ArrowRight } from 'lucide-react';
import { cn } from '../lib/cn';
import { STATUS_STYLES } from '../lib/status';
import { StatusDot } from './StatusBadge';

interface Props {
  stats: ApplicationStats | undefined;
  activeStatus: ApplicationStatus | undefined;
  overdueActive: boolean;
  onSelectStatus: (status: ApplicationStatus | undefined) => void;
  onToggleOverdue: () => void;
}

/** Per-status counts that double as filter tabs, plus a pipeline bar and overdue callout. */
export function StatusSummary({
  stats,
  activeStatus,
  overdueActive,
  onSelectStatus,
  onToggleOverdue,
}: Props) {
  const total = stats?.total ?? 0;
  const loading = !stats;

  return (
    <section aria-label="Pipeline summary" className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard
          label="All"
          count={total}
          loading={loading}
          active={!activeStatus}
          onClick={() => onSelectStatus(undefined)}
        />
        {APPLICATION_STATUSES.map((status) => (
          <SummaryCard
            key={status}
            label={STATUS_LABELS[status]}
            count={stats?.byStatus[status] ?? 0}
            loading={loading}
            status={status}
            active={activeStatus === status}
            onClick={() => onSelectStatus(activeStatus === status ? undefined : status)}
          />
        ))}
      </div>

      {total > 0 && (
        <div
          className="flex h-1.5 overflow-hidden rounded-full bg-zinc-200"
          role="img"
          aria-label={APPLICATION_STATUSES.map(
            (s) => `${STATUS_LABELS[s]}: ${stats?.byStatus[s] ?? 0}`,
          ).join(', ')}
        >
          {APPLICATION_STATUSES.map((s) => {
            const n = stats?.byStatus[s] ?? 0;
            return n ? (
              <div
                key={s}
                className={cn('h-full transition-all duration-500', STATUS_STYLES[s].bar)}
                style={{ width: `${(n / total) * 100}%` }}
              />
            ) : null;
          })}
        </div>
      )}

      {!!stats?.overdueFollowUps && (
        <button
          type="button"
          onClick={onToggleOverdue}
          aria-pressed={overdueActive}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors',
            overdueActive
              ? 'border-red-300 bg-red-100 text-red-900'
              : 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
          )}
        >
          <TriangleAlert className="size-4 shrink-0 text-red-600" aria-hidden />
          <span className="flex-1">
            <strong className="font-semibold">
              {stats.overdueFollowUps} follow-up{stats.overdueFollowUps === 1 ? '' : 's'} overdue.
            </strong>{' '}
            <span className="text-red-700">
              A quick nudge to a recruiter can move things along.
            </span>
          </span>
          <span className="inline-flex items-center gap-1 font-medium">
            {overdueActive ? 'Show all' : 'Review'}
            <ArrowRight className="size-3.5" aria-hidden />
          </span>
        </button>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  count,
  status,
  active,
  loading,
  onClick,
}: {
  label: string;
  count: number;
  status?: ApplicationStatus;
  active: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group rounded-xl border bg-white px-4 py-3 text-left transition-all',
        active
          ? 'border-zinc-900 shadow-sm ring-1 ring-zinc-900'
          : 'border-zinc-200 hover:border-zinc-300 hover:shadow-sm',
      )}
    >
      <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-500 group-aria-pressed:text-zinc-900">
        {status ? (
          <StatusDot status={status} />
        ) : (
          <span className="inline-block size-2 rounded-full bg-zinc-900" />
        )}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">
        {loading ? (
          <span className="inline-block h-7 w-8 animate-pulse rounded bg-zinc-100" />
        ) : (
          count
        )}
      </div>
    </button>
  );
}
