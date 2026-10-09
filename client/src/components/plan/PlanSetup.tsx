import {
  DEFAULT_STUDY_DAYS,
  NEETCODE_150,
  PACE_LABELS,
  PACE_PER_DAY,
  STUDY_PACES,
  WEEKDAY_SHORT,
  buildSchedule,
  countStudyDays,
  type StudyPace,
  type StudyPlan,
  type StudyPlanInput,
} from '@job-tracker/shared';
import { LoaderCircle, RotateCcw, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { cn } from '../../lib/cn';
import { formatDate, todayISO } from '../../lib/dates';
import { Button, IconButton } from '../ui/Button';

interface Props {
  existing: StudyPlan | null;
  solved: ReadonlyMap<string, string>;
  onSave: (input: StudyPlanInput) => Promise<unknown>;
  onCancel: () => void;
  onReset?: () => void;
}

const PACE_BLURB: Record<StudyPace, string> = {
  low: 'Steady — fits around classes',
  medium: 'Balanced — most people pick this',
  high: 'Intense — interview soon',
};

/** Pick pace, study days and start date, with a live "you'll finish on…" preview. */
export function PlanSetup({ existing, solved, onSave, onCancel, onReset }: Props) {
  const today = todayISO();
  const [pace, setPace] = useState<StudyPace>(existing?.pace ?? 'medium');
  const [studyDays, setStudyDays] = useState<number[]>(existing?.studyDays ?? DEFAULT_STUDY_DAYS.medium);
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [touchedDays, setTouchedDays] = useState(Boolean(existing));
  const [touchedStart, setTouchedStart] = useState(false);
  const [saving, setSaving] = useState(false);

  function choosePace(p: StudyPace) {
    setPace(p);
    // Until the user customizes days, follow the pace's suggested days.
    if (!touchedDays) setStudyDays(DEFAULT_STUDY_DAYS[p]);
  }

  function toggleDay(d: number) {
    setTouchedDays(true);
    setStudyDays((days) => (days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort()));
  }

  // Changing pace or days mid-plan restarts the schedule from today (solved problems are kept);
  // otherwise every past day would be re-measured against the new pace.
  const rescheduled =
    existing !== null &&
    (pace !== existing.pace || studyDays.join() !== existing.studyDays.join()) &&
    !touchedStart;
  const effectiveStart = rescheduled ? today : startDate;

  const preview = useMemo(() => {
    if (studyDays.length === 0 || !effectiveStart) return null;
    const s = buildSchedule({ problems: NEETCODE_150, solved, pace, studyDays, startDate: effectiveStart, today });
    const finish = s.projectedFinish;
    return {
      finish,
      weeks: finish ? Math.ceil(countStudyDays(today < effectiveStart ? effectiveStart : today, finish, [0, 1, 2, 3, 4, 5, 6]) / 7) : 0,
      remaining: s.total - s.solvedCount,
    };
  }, [pace, studyDays, effectiveStart, solved, today]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (studyDays.length === 0) return;
    setSaving(true);
    try {
      await onSave({ pace, studyDays, startDate: effectiveStart });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-h-[90dvh] flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
        <div>
          <h2 id="plan-setup-title" className="font-semibold">
            {existing ? 'Edit your NeetCode 150 plan' : 'Start NeetCode 150'}
          </h2>
          <p className="text-sm text-zinc-500">150 problems, topic by topic, a few each study day.</p>
        </div>
        <IconButton aria-label="Close" onClick={onCancel}>
          <X className="size-4" />
        </IconButton>
      </div>

      <div className="space-y-5 overflow-y-auto px-5 py-4">
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-zinc-700">Pace</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {STUDY_PACES.map((p) => (
              <label
                key={p}
                className={cn(
                  'cursor-pointer rounded-lg border p-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-zinc-900',
                  pace === p ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300',
                )}
              >
                <input type="radio" name="pace" value={p} checked={pace === p} onChange={() => choosePace(p)} className="sr-only" />
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{PACE_LABELS[p]}</span>
                  <span className="text-xs text-zinc-500">{PACE_PER_DAY[p]}/day</span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">{PACE_BLURB[p]}</p>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-zinc-700">Study days</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_SHORT.map((label, d) => {
              const on = studyDays.includes(d);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(d)}
                  className={cn(
                    'h-9 w-12 rounded-lg border text-sm font-medium transition-colors',
                    on ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {studyDays.length === 0 && <p role="alert" className="mt-1.5 text-xs text-red-600">Pick at least one day.</p>}
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="plan-start" className="block text-[13px] font-medium text-zinc-700">
            Start date
          </label>
          <input
            id="plan-start"
            type="date"
            className="input w-auto"
            value={effectiveStart}
            onChange={(e) => {
              setTouchedStart(true);
              setStartDate(e.target.value || today);
            }}
          />
          {rescheduled && (
            <p className="text-xs text-zinc-500">
              New pace starts today. Your solved problems are kept.
            </p>
          )}
        </div>

        {preview && (
          <div className="rounded-lg bg-violet-50 px-4 py-3 text-sm text-violet-900 ring-1 ring-violet-200">
            {preview.finish ? (
              <>
                <span className="font-semibold">Finish around {formatDate(preview.finish, today)}</span> —{' '}
                {preview.remaining} problems left, about {preview.weeks} week{preview.weeks === 1 ? '' : 's'}.
                Miss a day and the plan shifts forward automatically.
              </>
            ) : (
              <span className="font-semibold">You’ve solved all 150. Nice work.</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4">
        {existing && onReset ? (
          <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={onReset}>
            <RotateCcw className="size-4" aria-hidden />
            Stop plan
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving || studyDays.length === 0}>
            {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {existing ? 'Save plan' : 'Start plan'}
          </Button>
        </div>
      </div>
    </form>
  );
}
