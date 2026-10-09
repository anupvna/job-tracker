import { BellRing, CalendarCheck, Flame, ListChecks, type LucideIcon } from 'lucide-react';

const COMING: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ListChecks,
    title: 'NeetCode 150 study plan',
    body: 'Pick a pace — low, medium or high — and get a day-by-day list of problems in roadmap order.',
  },
  {
    icon: CalendarCheck,
    title: 'A plan that adapts',
    body: 'Miss a day and the rest of the plan shifts forward, so nothing piles up as “overdue”.',
  },
  {
    icon: BellRing,
    title: 'Revision reminders',
    body: 'Solved problems come back for review after 1, 3, 7, 14 and 30 days — sooner if they were hard.',
  },
  {
    icon: Flame,
    title: 'Streaks and progress',
    body: 'A daily streak, an activity heatmap and per-topic progress bars, plus a countdown to your goal.',
  },
];

/** Prep tab. Phase 0 ships the page shell; the planner itself lands in the next phases. */
export function PrepPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Prep</h1>
        <p className="text-sm text-zinc-500">Plan your interview prep and keep it on track.</p>
      </div>

      <section
        aria-labelledby="prep-coming-title"
        className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs"
      >
        <div className="border-b border-zinc-100 px-5 py-4">
          <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
            Coming soon
          </span>
          <h2 id="prep-coming-title" className="mt-2 font-semibold">
            Your SWE prep planner is on its way
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Here’s what this tab will do. Your applications are unaffected and stay on the
            Applications tab.
          </p>
        </div>
        <ul className="grid gap-px bg-zinc-100 sm:grid-cols-2">
          {COMING.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3 bg-white px-5 py-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                <Icon className="size-4 text-zinc-700" aria-hidden />
              </div>
              <div>
                <div className="text-sm font-medium">{title}</div>
                <p className="text-sm text-zinc-500">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
