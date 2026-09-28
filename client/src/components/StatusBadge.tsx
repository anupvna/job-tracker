import {
  REFERRAL_LABELS,
  STATUS_LABELS,
  type ApplicationStatus,
  type ReferralStatus,
} from '@job-tracker/shared';
import { Check, Clock, UserRound } from 'lucide-react';
import { cn } from '../lib/cn';
import { REFERRAL_STYLES, STATUS_STYLES } from '../lib/status';

export function StatusDot({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-block size-2 rounded-full', STATUS_STYLES[status].dot, className)}
    />
  );
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        STATUS_STYLES[status].badge,
      )}
    >
      <StatusDot status={status} className="size-1.5" />
      {STATUS_LABELS[status]}
    </span>
  );
}

const REFERRAL_ICON = { not_asked: UserRound, asked: Clock, referred: Check } as const;

export function ReferralInfo({ name, status }: { name: string | null; status: ReferralStatus }) {
  if (!name && status === 'not_asked') return <span className="text-zinc-400">—</span>;
  const Icon = REFERRAL_ICON[status];
  return (
    <div className="min-w-0">
      {name && <div className="truncate text-sm text-zinc-800">{name}</div>}
      <div className={cn('flex items-center gap-1 text-xs font-medium', REFERRAL_STYLES[status])}>
        <Icon className="size-3" aria-hidden />
        {REFERRAL_LABELS[status]}
      </div>
    </div>
  );
}
