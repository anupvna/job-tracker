import type { ApplicationStatus, ReferralStatus } from '@job-tracker/shared';

/** Visual tokens per pipeline stage. One place to change the palette. */
export const STATUS_STYLES: Record<
  ApplicationStatus,
  { dot: string; badge: string; bar: string; ring: string }
> = {
  wishlist: {
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700 ring-slate-200',
    bar: 'bg-slate-300',
    ring: 'ring-slate-400',
  },
  applied: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 ring-blue-200',
    bar: 'bg-blue-500',
    ring: 'ring-blue-500',
  },
  interviewing: {
    dot: 'bg-violet-500',
    badge: 'bg-violet-50 text-violet-700 ring-violet-200',
    bar: 'bg-violet-500',
    ring: 'ring-violet-500',
  },
  offer: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    bar: 'bg-emerald-500',
    ring: 'ring-emerald-500',
  },
  rejected: {
    dot: 'bg-rose-400',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    bar: 'bg-rose-300',
    ring: 'ring-rose-400',
  },
};

export const REFERRAL_STYLES: Record<ReferralStatus, string> = {
  not_asked: 'text-zinc-500',
  asked: 'text-amber-700',
  referred: 'text-emerald-700',
};
