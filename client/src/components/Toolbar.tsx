import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from '@job-tracker/shared';
import { BellRing, Search, X } from 'lucide-react';
import { cn } from '../lib/cn';

interface Props {
  search: string;
  onSearchChange: (q: string) => void;
  status: ApplicationStatus | undefined;
  onStatusChange: (s: ApplicationStatus | undefined) => void;
  overdue: boolean;
  onOverdueChange: (v: boolean) => void;
  resultCount: number | undefined;
  isFiltered: boolean;
  onReset: () => void;
}

export function Toolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  overdue,
  onOverdueChange,
  resultCount,
  isFiltered,
  onReset,
}: Props) {
  return (
    <div className="flex flex-col gap-2 border-b border-zinc-200 px-4 py-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search company, role, referral…"
          aria-label="Search applications"
          className="input h-9 pl-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <select
          value={status ?? ''}
          onChange={(e) =>
            onStatusChange((e.target.value || undefined) as ApplicationStatus | undefined)
          }
          aria-label="Filter by status"
          className="input h-9 w-auto py-0 pr-8"
        >
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-pressed={overdue}
          onClick={() => onOverdueChange(!overdue)}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium whitespace-nowrap transition-colors',
            overdue
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50',
          )}
        >
          <BellRing className="size-4" aria-hidden />
          Overdue
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm text-zinc-500 sm:ml-auto">
        {resultCount !== undefined && (
          <span aria-live="polite" className="tabular-nums">
            {resultCount} {resultCount === 1 ? 'application' : 'applications'}
          </span>
        )}
        {isFiltered && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 font-medium text-zinc-700 hover:text-zinc-900"
          >
            <X className="size-3.5" aria-hidden />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
