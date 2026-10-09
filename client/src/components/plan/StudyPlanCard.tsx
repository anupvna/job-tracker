import { type Problem, type ReviewRating } from '@job-tracker/shared';
import { ArrowRight, CalendarCheck, ChevronDown, Coffee, ListChecks, Settings2, Sparkles } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { toast } from 'sonner';
import { useRateProblem, useStudyPlan, useToggleProblem } from '../../hooks/useStudyPlan';
import { cn } from '../../lib/cn';
import { dayHeading, formatDate } from '../../lib/dates';
import { navigate, ROUTE_PATHS } from '../../lib/router';
import { Button, IconButton } from '../ui/Button';
import { PlanStatus, ProgressBar } from './PlanStatus';
import { ProblemRow } from './ProblemRow';
import { RevisionList } from './RevisionList';
import { usePlanEditor } from './PlanEditor';

function openAll(e: MouseEvent<HTMLAnchorElement>) {
  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  navigate('neetcode');
}

/** The Prep tab's study-plan panel: today's problems, pace status and what's next. */
export function StudyPlanCard() {
  const { plan, schedule, progress, today, isPending, isError } = useStudyPlan();
  const toggle = useToggleProblem();
  const rate = useRateProblem();
  const { openEditor, modals } = usePlanEditor();
  const [showNext, setShowNext] = useState(false);

  function onToggle(problem: Problem, solved: boolean) {
    toggle.mutate(
      { slug: problem.slug, solved },
      {
        onSuccess: () => solved && toast.success(`Solved ${problem.title}`),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function onRate(problem: Problem, rating: ReviewRating) {
    rate.mutate({ slug: problem.slug, rating }, { onError: (err) => toast.error(err.message) });
  }

  if (isPending) {
    return <div className="h-40 animate-pulse rounded-xl border border-zinc-200 bg-white" aria-busy="true" aria-label="Loading study plan" />;
  }
  if (isError) return null; // The tasks list below still works; don't block the page.

  if (!plan || !schedule) {
    return (
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-100">
            <ListChecks className="size-5 text-violet-700" aria-hidden />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Start the NeetCode 150</h2>
            <p className="text-sm text-zinc-500">
              Pick a pace and get a day-by-day problem plan that adapts when you miss a day.
            </p>
          </div>
          <Button variant="primary" onClick={openEditor}>
            <Sparkles className="size-4" aria-hidden />
            Set up my plan
          </Button>
        </div>
        {modals}
      </section>
    );
  }

  const todayDone = schedule.today?.items.filter((i) => i.solved).length ?? 0;
  const todayTotal = schedule.today?.items.length ?? 0;
  const next = schedule.upcoming.slice(0, 3);
  // Before the start date, show what's coming without an extra click.
  const expanded = showNext || !schedule.started;

  return (
    <section aria-labelledby="plan-title" className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
      <div className="space-y-3 border-b border-zinc-100 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="plan-title" className="font-semibold">
            NeetCode 150
            {schedule.today && <span className="font-normal text-zinc-500"> · Day {schedule.today.dayNumber}</span>}
          </h2>
          <PlanStatus schedule={schedule} startDate={plan.startDate} today={today} />
          <div className="ml-auto flex items-center gap-1">
            <a
              href={ROUTE_PATHS.neetcode}
              onClick={openAll}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              All problems
              <ArrowRight className="size-3.5" aria-hidden />
            </a>
            <IconButton aria-label="Edit plan" onClick={openEditor}>
              <Settings2 className="size-4" />
            </IconButton>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ProgressBar value={schedule.solvedCount} total={schedule.total} className="flex-1" />
          <span className="text-xs font-medium text-zinc-600 tabular-nums">
            {schedule.solvedCount}/{schedule.total}
          </span>
        </div>
        {!schedule.completed && schedule.projectedFinish && (
          <p className="text-xs text-zinc-500">
            At this pace you’ll finish around{' '}
            <span className="font-medium text-zinc-700">{formatDate(schedule.projectedFinish, today)}</span>
            {schedule.delta < 0 && schedule.projectedFinish !== schedule.plannedFinish && (
              <> (originally {formatDate(schedule.plannedFinish, today)}). Missed work has moved forward — just do today’s list.</>
            )}
          </p>
        )}
      </div>

      {schedule.completed ? (
        <Message icon={Sparkles} title="All 150 solved" body="Incredible work. Keep up the revisions below so it sticks." />
      ) : schedule.today ? (
        <div>
          <h3 className="flex items-center justify-between bg-zinc-50 px-4 py-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase sm:px-5">
            <span>Today’s problems</span>
            <span className={cn('tabular-nums', todayDone === todayTotal && 'text-emerald-600')}>
              {todayDone}/{todayTotal} done
            </span>
          </h3>
          {todayTotal > 0 && todayDone === todayTotal && (
            <p className="flex items-center gap-2 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 sm:px-5">
              <CalendarCheck className="size-4" aria-hidden />
              Today’s plan is done. Anything extra you solve puts you ahead.
            </p>
          )}
          <ul className="divide-y divide-zinc-100">
            {schedule.today.items.map(({ problem, solved }) => (
              <ProblemRow
                key={problem.slug}
                problem={problem}
                solved={solved}
                onToggle={onToggle}
                showTopic
                progress={progress.get(problem.slug)}
                today={today}
                onRate={onRate}
              />
            ))}
          </ul>
        </div>
      ) : schedule.started ? (
        <Message icon={Coffee} title="Rest day" body="No problems scheduled today. Solve one anyway and you’ll be ahead." />
      ) : (
        <Message icon={CalendarCheck} title={`Your plan starts ${formatDate(plan.startDate, today)}`} body="Here’s what your first days look like." />
      )}

      <RevisionList progress={progress} today={today} />

      {next.length > 0 && !schedule.completed && (
        <div className="border-t border-zinc-100">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setShowNext((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 sm:px-5"
          >
            Coming up
            <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} aria-hidden />
          </button>
          {expanded && (
            <ol className="space-y-3 px-4 pb-4 sm:px-5">
              {next.map((day) => (
                <li key={day.date}>
                  <div className="text-xs font-semibold text-zinc-500">
                    Day {day.dayNumber} · {dayHeading(day.date, today)}
                  </div>
                  <div className="mt-0.5 text-sm text-zinc-800">{day.problems.map((p) => p.title).join(' · ')}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {modals}
    </section>
  );
}

function Message({ icon: Icon, title, body }: { icon: typeof Coffee; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
      <Icon className="mt-0.5 size-5 shrink-0 text-zinc-400" aria-hidden />
      <div>
        <p className="text-sm font-medium text-zinc-900">{title}</p>
        <p className="text-sm text-zinc-500">{body}</p>
      </div>
    </div>
  );
}
