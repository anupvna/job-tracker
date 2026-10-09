import { GOAL_LIMITS, prepGoalsSchema, type PrepGoals, type PrepGoalsInput } from '@job-tracker/shared';
import { LoaderCircle, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, IconButton } from '../ui/Button';
import { Field } from '../ui/Field';

/** Edit the goal date and weekly targets. */
export function GoalsEditor({
  goals,
  onSave,
  onCancel,
}: {
  goals: PrepGoals;
  onSave: (g: PrepGoalsInput) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [targetDate, setTargetDate] = useState(goals.targetDate);
  const [weeklyProblems, setWeeklyProblems] = useState(String(goals.weeklyProblems));
  const [weeklyApplications, setWeeklyApplications] = useState(String(goals.weeklyApplications));
  const [weeklyReferrals, setWeeklyReferrals] = useState(String(goals.weeklyReferrals));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = prepGoalsSchema.safeParse({
      targetDate,
      weeklyProblems: Number(weeklyProblems),
      weeklyApplications: Number(weeklyApplications),
      weeklyReferrals: Number(weeklyReferrals),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the values');
      return;
    }
    setSaving(true);
    try {
      await onSave(parsed.data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
        <div>
          <h2 id="goals-title" className="font-semibold">Your goals</h2>
          <p className="text-sm text-zinc-500">A finish line and weekly targets to measure yourself against.</p>
        </div>
        <IconButton aria-label="Close" onClick={onCancel}>
          <X className="size-4" />
        </IconButton>
      </div>
      <div className="space-y-4 px-5 py-4">
        <Field label="Goal date (have an offer by)" htmlFor="goal-date">
          <input id="goal-date" type="date" className="input" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </Field>
        <p className="text-xs text-zinc-500">Weekly targets (Monday–Sunday). Progress is tracked automatically from your Prep and Applications tabs.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Problems per week" htmlFor="goal-problems">
            <input
              id="goal-problems"
              type="number"
              inputMode="numeric"
              min={0}
              max={GOAL_LIMITS.weeklyProblems}
              className="input"
              value={weeklyProblems}
              onChange={(e) => setWeeklyProblems(e.target.value)}
            />
          </Field>
          <Field label="Applications per week" htmlFor="goal-apps">
            <input
              id="goal-apps"
              type="number"
              inputMode="numeric"
              min={0}
              max={GOAL_LIMITS.weeklyApplications}
              className="input"
              value={weeklyApplications}
              onChange={(e) => setWeeklyApplications(e.target.value)}
            />
          </Field>
          <Field label="With a referral" htmlFor="goal-referrals" hint="Applications marked Referred">
            <input
              id="goal-referrals"
              type="number"
              inputMode="numeric"
              min={0}
              max={GOAL_LIMITS.weeklyReferrals}
              className="input"
              value={weeklyReferrals}
              onChange={(e) => setWeeklyReferrals(e.target.value)}
            />
          </Field>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          Save goals
        </Button>
      </div>
    </form>
  );
}
