import { getFollowUpState, type Application } from '@job-tracker/shared';
import { ArrowRight, BellRing, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useApplicationsList, useUpdateApplication } from '../../hooks/useApplications';
import { cn } from '../../lib/cn';
import { addDays, relativeFollowUp } from '../../lib/dates';
import { navigate } from '../../lib/router';

// Same filters as the Applications tab's default view, so both share one cached query.
const FILTERS = { sort: 'followUpDate', order: 'asc' } as const;

/** Job follow-ups due today or overdue, pulled from the tracker into the Today list. */
export function FollowUpsDue({ today }: { today: string }) {
  const apps = useApplicationsList(FILTERS);
  const update = useUpdateApplication();

  const due = (apps.data ?? []).filter((a) => {
    const state = getFollowUpState(a, today);
    return state === 'overdue' || state === 'today';
  });
  if (due.length === 0) return null;

  function followedUp(app: Application) {
    const next = addDays(today, 7);
    update.mutate(
      { id: app.id, patch: { followUpDate: next } },
      {
        onSuccess: () => toast.success(`${app.company}: next follow-up in 7 days`),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <section aria-labelledby="followups-title">
      <h3
        id="followups-title"
        className="flex items-center gap-1.5 border-y border-zinc-100 bg-zinc-50 px-4 py-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase"
      >
        <BellRing className="size-3.5" aria-hidden />
        Job follow-ups · {due.length}
      </h3>
      <ul className="divide-y divide-zinc-100">
        {due.map((app) => {
          const overdue = getFollowUpState(app, today) === 'overdue';
          return (
            <li key={app.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-900">
                  Follow up with <span className="font-medium">{app.company}</span>
                  <span className="text-zinc-500"> · {app.role}</span>
                </div>
                <div className={cn('mt-0.5 text-xs', overdue ? 'font-medium text-red-600' : 'text-zinc-500')}>
                  {relativeFollowUp(app.followUpDate!, today)}
                  {app.referralName && <span className="font-normal text-zinc-500"> · referral: {app.referralName}</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => followedUp(app)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <Check className="size-3.5" aria-hidden />
                  Done · next in 7d
                </button>
                <a
                  href="/?overdue=true"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                    e.preventDefault();
                    navigate('applications');
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  Open
                  <ArrowRight className="size-3.5" aria-hidden />
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
