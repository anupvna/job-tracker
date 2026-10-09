import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  isOverdue,
  type Application,
  type ApplicationStatus,
  type SortField,
  type SnapshotSummary,
} from '@job-tracker/shared';
import { ArchiveX, ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { formatDate, timeAgo } from '../lib/dates';
import { STATUS_STYLES } from '../lib/status';
import { FollowUpCell } from './FollowUpCell';
import { ReferralInfo } from './StatusBadge';
import { IconButton } from './ui/Button';

interface Props {
  rows: Application[];
  today: string;
  sort: SortField;
  order: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  onEdit: (app: Application) => void;
  onDelete: (app: Application) => void;
  onStatusChange: (app: Application, status: ApplicationStatus) => void;
  /** Saved-posting status per application id (shows a "Posting closed" badge). */
  postings?: ReadonlyMap<string, SnapshotSummary>;
}

export function ApplicationsTable({
  rows,
  today,
  sort,
  order,
  onSort,
  onEdit,
  onDelete,
  onStatusChange,
  postings,
}: Props) {
  const header = (field: SortField, label: string, className?: string) => (
    <SortHeader
      field={field}
      label={label}
      sort={sort}
      order={order}
      onSort={onSort}
      className={className}
    />
  );

  return (
    <>
      <MobileList
        rows={rows}
        today={today}
        onEdit={onEdit}
        onStatusChange={onStatusChange}
        postings={postings}
      />
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[880px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
              {header('company', 'Company / Role', 'pl-4 w-[28%]')}
              {header('status', 'Status', 'w-[14%]')}
              <Th className="w-[16%]">Referral</Th>
              {header('appliedDate', 'Applied', 'w-[11%]')}
              {header('followUpDate', 'Follow-up', 'w-[14%]')}
              {header('updatedAt', 'Updated', 'w-[10%]')}
              <Th className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((app) => {
              const overdue = isOverdue(app, today);
              const closed = app.status === 'rejected';
              return (
                <tr
                  key={app.id}
                  onClick={() => onEdit(app)}
                  data-overdue={overdue || undefined}
                  className={cn(
                    'group cursor-pointer transition-colors',
                    overdue ? 'bg-red-50/70 hover:bg-red-50' : 'hover:bg-zinc-50',
                  )}
                >
                  <Td
                    className={cn('pl-4', overdue && 'shadow-[inset_3px_0_0_var(--color-red-500)]')}
                  >
                    <div className={cn('min-w-0', closed && 'opacity-60')}>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(app);
                          }}
                          className="truncate font-semibold text-zinc-900 hover:underline"
                        >
                          {app.company}
                        </button>
                        {app.link && (
                          <a
                            href={app.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 rounded text-zinc-400 hover:text-zinc-900"
                            aria-label={`Open ${app.company} job posting`}
                            title="Open job posting"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                      <div className="truncate text-[13px] text-zinc-500">{app.role}</div>
                      <ClosedBadge summary={postings?.get(app.id)} />
                    </div>
                  </Td>
                  <Td>
                    <InlineStatusSelect app={app} onChange={(s) => onStatusChange(app, s)} />
                  </Td>
                  <Td>
                    <ReferralInfo name={app.referralName} status={app.referralStatus} />
                  </Td>
                  <Td className="text-zinc-700 tabular-nums">
                    {formatDate(app.appliedDate, today)}
                  </Td>
                  <Td>
                    <FollowUpCell app={app} today={today} />
                  </Td>
                  <Td
                    className="text-[13px] text-zinc-500"
                    title={new Date(app.updatedAt).toLocaleString()}
                  >
                    {timeAgo(app.updatedAt)}
                  </Td>
                  <Td className="pr-4">
                    <div className="flex justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <IconButton
                        aria-label={`Edit ${app.company}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(app);
                        }}
                      >
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton
                        aria-label={`Delete ${app.company}`}
                        className="hover:bg-red-50 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(app);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Card layout for small screens, where a 7-column table would need sideways scrolling. */
function MobileList({
  rows,
  today,
  onEdit,
  onStatusChange,
  postings,
}: Pick<Props, 'rows' | 'today' | 'onEdit' | 'onStatusChange' | 'postings'>) {
  return (
    <ul className="divide-y divide-zinc-100 md:hidden">
      {rows.map((app) => {
        const overdue = isOverdue(app, today);
        return (
          <li
            key={app.id}
            data-overdue={overdue || undefined}
            className={cn(
              'px-4 py-3.5',
              overdue && 'bg-red-50/70 shadow-[inset_3px_0_0_var(--color-red-500)]',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => onEdit(app)} className="min-w-0 text-left">
                <div className="truncate font-semibold text-zinc-900">{app.company}</div>
                <div className="truncate text-[13px] text-zinc-500">{app.role}</div>
                <ClosedBadge summary={postings?.get(app.id)} />
              </button>
              <InlineStatusSelect app={app} onChange={(s) => onStatusChange(app, s)} />
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="mb-0.5 font-medium text-zinc-400 uppercase">Follow-up</div>
                <FollowUpCell app={app} today={today} />
              </div>
              <div>
                <div className="mb-0.5 font-medium text-zinc-400 uppercase">Referral</div>
                <ReferralInfo name={app.referralName} status={app.referralStatus} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn('border-b border-zinc-200 bg-zinc-50/80 px-3 py-2.5 font-medium', className)}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td title={title} className={cn('border-b border-zinc-100 px-3 py-3 align-middle', className)}>
      {children}
    </td>
  );
}

function SortHeader({
  field,
  label,
  sort,
  order,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  sort: SortField;
  order: 'asc' | 'desc';
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = sort === field;
  const Icon = !active ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('border-b border-zinc-200 bg-zinc-50/80 px-3 py-2.5 font-medium', className)}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1 uppercase hover:text-zinc-900',
          active && 'text-zinc-900',
        )}
      >
        {label}
        <Icon className={cn('size-3', !active && 'opacity-40')} aria-hidden />
      </button>
    </th>
  );
}

/** A <select> dressed as a status badge, for one-click stage changes. */
function InlineStatusSelect({
  app,
  onChange,
}: {
  app: Application;
  onChange: (s: ApplicationStatus) => void;
}) {
  return (
    <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <span
        className={cn(
          'pointer-events-none absolute top-1/2 left-2 size-1.5 -translate-y-1/2 rounded-full',
          STATUS_STYLES[app.status].dot,
        )}
      />
      <select
        value={app.status}
        onChange={(e) => onChange(e.target.value as ApplicationStatus)}
        aria-label={`Status for ${app.company}`}
        className={cn(
          'cursor-pointer appearance-none rounded-full py-0.5 pr-2.5 pl-5 text-xs font-medium ring-1 ring-inset transition-shadow hover:shadow-sm focus:outline-none focus-visible:ring-2',
          STATUS_STYLES[app.status].badge,
        )}
      >
        {APPLICATION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Shown when the saved job posting has been taken down. */
function ClosedBadge({ summary }: { summary: SnapshotSummary | undefined }) {
  if (summary?.postingStatus !== 'closed') return null;
  return (
    <span
      className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-px text-[11px] font-medium text-red-700 ring-1 ring-red-200"
      title="The job board no longer lists this posting — it's probably filled. Your saved copy of the description is still in the application."
    >
      <ArchiveX className="size-3" aria-hidden />
      Posting closed
    </span>
  );
}
