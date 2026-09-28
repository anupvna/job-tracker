import type { Application } from '@job-tracker/shared';
import { Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Dialog';

interface Props {
  target: Application | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDelete({ target, pending, onCancel, onConfirm }: Props) {
  return (
    <Modal open={Boolean(target)} onClose={onCancel} labelledBy="confirm-delete-title">
      <div className="p-6">
        <div className="flex gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <Trash2 className="size-5 text-red-600" aria-hidden />
          </div>
          <div>
            <h2 id="confirm-delete-title" className="text-base font-semibold">
              Delete application?
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              <strong className="font-medium text-zinc-900">{target?.company}</strong> —{' '}
              {target?.role} will be permanently removed, including its notes and referral details.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {pending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
