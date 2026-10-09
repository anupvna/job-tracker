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
    reset.mutate(undefined, {
      onSuccess: () => toast.success('Plan stopped. Your solved problems are kept.'),
      onError: (err) => toast.error(err.message),
    });
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
            The daily schedule goes away. Problems you’ve already solved stay ticked, so you can
            start a new plan any time without losing progress.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setConfirmReset(false)}>Keep plan</Button>
            <Button variant="danger" onClick={onConfirmReset}>
              Stop plan
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );

  return { openEditor: () => setOpen(true), modals };
}
