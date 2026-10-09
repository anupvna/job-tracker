import type { StudyPlanInput } from '@job-tracker/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { useResetPlan, useSavePlan, useStudyPlan } from '../../hooks/useStudyPlan';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Dialog';
import { PlanSetup } from './PlanSetup';

/** Setup / edit modal plus "stop plan" confirmation, shared by the Prep and NeetCode pages. */
export function usePlanEditor() {
  const { plan, solved } = useStudyPlan();
  const save = useSavePlan();
  const reset = useResetPlan();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [clearProgress, setClearProgress] = useState(false);

  async function onSave(input: StudyPlanInput) {
    try {
      await save.mutateAsync(input);
      toast.success(plan ? 'Plan updated' : 'Plan started — your first problems are in Today');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the plan');
    }
  }

  function onConfirmReset() {
    reset.mutate(
      { clearProgress },
      {
        onSuccess: () =>
          toast.success(
            clearProgress
              ? 'Plan stopped and progress cleared. You’re starting fresh.'
              : 'Plan stopped. Your solved problems are kept.',
          ),
        onError: (err) => toast.error(err.message),
      },
    );
    setClearProgress(false);
    setConfirmReset(false);
    setOpen(false);
  }

  const modals = (
    <>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy="plan-setup-title" className="max-w-xl">
        {open && (
          <PlanSetup
            existing={plan}
            solved={solved}
            onSave={onSave}
            onCancel={() => setOpen(false)}
            onReset={() => setConfirmReset(true)}
          />
        )}
      </Modal>
      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} labelledBy="plan-reset-title">
        <div className="p-5">
          <h2 id="plan-reset-title" className="font-semibold">
            Stop your NeetCode 150 plan?
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            The daily schedule goes away. By default, problems you’ve solved stay ticked (and keep
            counting toward your streak and weekly target), so a new plan picks up where you left off.
          </p>
          <label className="mt-4 flex items-start gap-2.5 rounded-lg border border-zinc-200 p-3 text-sm">
            <input
              type="checkbox"
              checked={clearProgress}
              onChange={(e) => setClearProgress(e.target.checked)}
              className="mt-0.5 size-4 accent-red-600"
            />
            <span>
              <span className="font-medium text-zinc-900">Also clear my progress</span>
              <span className="block text-zinc-500">
                Un-tick every solved problem and delete revision history. This can’t be undone.
              </span>
            </span>
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setConfirmReset(false)}>Keep plan</Button>
            <Button variant="danger" onClick={onConfirmReset}>
              {clearProgress ? 'Stop and clear' : 'Stop plan'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );

  return { openEditor: () => setOpen(true), modals };
}
