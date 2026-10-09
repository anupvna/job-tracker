import { NEETCODE_150, NEETCODE_TOPICS, type Difficulty, type Problem } from '@job-tracker/shared';
import { ArrowLeft, ChevronDown, Settings2, Sparkles } from 'lucide-react';
import { useMemo, useState, type MouseEvent } from 'react';
import { toast } from 'sonner';
import { PlanStatus, ProgressBar } from '../components/plan/PlanStatus';
import { DifficultyPill, ProblemRow } from '../components/plan/ProblemRow';
import { usePlanEditor } from '../components/plan/PlanEditor';
import { ErrorState } from '../components/States';
import { Button } from '../components/ui/Button';
import { useStudyPlan, useToggleProblem } from '../hooks/useStudyPlan';
import { cn } from '../lib/cn';
import { formatDate } from '../lib/dates';
import { navigate, ROUTE_PATHS } from '../lib/router';

const BY_TOPIC = NEETCODE_TOPICS.map((topic) => ({
  topic,
  problems: NEETCODE_150.filter((p) => p.topic === topic),
}));

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

function back(e: MouseEvent<HTMLAnchorElement>) {
  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  navigate('prep');
}

/** The full NeetCode 150 checklist, grouped by topic, with progress per topic. */
export function NeetcodePage() {
  const { plan, solved, schedule, today, isPending, isError, error, refetch } = useStudyPlan();
  const toggle = useToggleProblem();
  const { openEditor, modals } = usePlanEditor();
  const [hideSolved, setHideSolved] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const byDifficulty = useMemo(
    () =>
      DIFFICULTIES.map((d) => {
        const all = NEETCODE_150.filter((p) => p.difficulty === d);
        return { d, total: all.length, done: all.filter((p) => solved.has(p.slug)).length };
      }),
    [solved],
  );
  const solvedCount = NEETCODE_150.filter((p) => solved.has(p.slug)).length;
  // Where today's plan is, so the user can see the current topic.
  const currentTopic = schedule?.today?.items.find((i) => !i.solved)?.problem.topic ?? schedule?.upcoming[0]?.problems[0]?.topic;

  function onToggle(problem: Problem, value: boolean) {
    toggle.mutate({ slug: problem.slug, solved: value }, { onError: (err) => toast.error(err.message) });
  }

  function toggleTopic(topic: string) {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <a
          href={ROUTE_PATHS.prep}
          onClick={back}
          className="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Prep
        </a>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">NeetCode 150</h1>
            <p className="text-sm text-zinc-500">
              The 150 problems from NeetCode’s roadmap, topic by topic. Titles link to LeetCode; the
              play button opens NeetCode’s video.
            </p>
          </div>
          {plan ? (
            <Button onClick={openEditor}>
              <Settings2 className="size-4" aria-hidden />
              Edit plan
            </Button>
          ) : (
            <Button variant="primary" onClick={openEditor}>
              <Sparkles className="size-4" aria-hidden />
              Set up a plan
            </Button>
          )}
        </div>
      </div>

      {isError ? (
        <ErrorState message={error instanceof Error ? error.message : 'Could not load progress'} onRetry={() => refetch()} />
      ) : (
        <>
          <section aria-label="Overall progress" className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-xs sm:grid-cols-[1.4fr_1fr] sm:p-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-3xl font-semibold tabular-nums">{isPending ? '–' : solvedCount}</span>
                <span className="text-sm text-zinc-500">of 150 solved</span>
                {plan && schedule && <PlanStatus schedule={schedule} startDate={plan.startDate} today={today} />}
              </div>
              <ProgressBar value={solvedCount} total={150} />
              {schedule?.projectedFinish && (
                <p className="text-xs text-zinc-500">
                  Finish around <span className="font-medium text-zinc-700">{formatDate(schedule.projectedFinish, today)}</span> at your current pace.
                </p>
              )}
            </div>
            <dl className="grid grid-cols-3 gap-2">
              {byDifficulty.map(({ d, total, done }) => (
                <div key={d} className="rounded-lg bg-zinc-50 px-3 py-2">
                  <dt><DifficultyPill difficulty={d} /></dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums">
                    {done}<span className="font-normal text-zinc-400">/{total}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700">Topics</h2>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" checked={hideSolved} onChange={(e) => setHideSolved(e.target.checked)} className="size-4 accent-zinc-900" />
              Hide solved
            </label>
          </div>

          <div className="space-y-3">
            {BY_TOPIC.map(({ topic, problems }, i) => {
              const done = problems.filter((p) => solved.has(p.slug)).length;
              const visible = hideSolved ? problems.filter((p) => !solved.has(p.slug)) : problems;
              const isCollapsed = collapsed.has(topic);
              const id = `topic-${i}`;
              return (
                <section key={topic} aria-labelledby={`${id}-title`} className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-controls={id}
                    onClick={() => toggleTopic(topic)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs font-semibold text-zinc-600 tabular-nums">
                      {i + 1}
                    </span>
                    <span id={`${id}-title`} className="min-w-0 flex-1 font-medium">
                      {topic}
                      {topic === currentTopic && (
                        <span className="ml-2 rounded-full bg-violet-100 px-1.5 py-px align-middle text-[11px] font-medium text-violet-700">
                          Current
                        </span>
                      )}
                    </span>
                    <ProgressBar value={done} total={problems.length} className="hidden w-24 sm:block" />
                    <span className={cn('text-xs font-medium tabular-nums', done === problems.length ? 'text-emerald-600' : 'text-zinc-500')}>
                      {done}/{problems.length}
                    </span>
                    <ChevronDown className={cn('size-4 text-zinc-400 transition-transform', !isCollapsed && 'rotate-180')} aria-hidden />
                  </button>
                  {!isCollapsed && (
                    <ul id={id} className="divide-y divide-zinc-100 border-t border-zinc-100">
                      {visible.map((p) => (
                        <ProblemRow key={p.slug} problem={p} solved={solved.has(p.slug)} onToggle={onToggle} />
                      ))}
                      {visible.length === 0 && <li className="px-4 py-3 text-sm text-zinc-500">All solved in this topic.</li>}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          <p className="text-center text-xs text-zinc-400">
            Problem list from NeetCode (neetcode.io, MIT-licensed data). Not affiliated with NeetCode or LeetCode.
          </p>
        </>
      )}
      {modals}
    </div>
  );
}
