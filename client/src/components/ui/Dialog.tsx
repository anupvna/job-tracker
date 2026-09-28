import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  className?: string;
  labelledBy?: string;
  children: ReactNode;
}

/**
 * Thin wrapper over the native <dialog> element: focus trapping, Escape-to-close,
 * top-layer stacking and inert background all come from the browser.
 */
export function Dialog({ open, onClose, className, labelledBy, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      className={className}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click whose target is the <dialog> itself landed on the backdrop.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && children}
    </dialog>
  );
}

export function Modal(props: DialogProps) {
  return (
    <Dialog
      {...props}
      className={cn(
        'modal fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-xl bg-white shadow-2xl ring-1 ring-zinc-900/5',
        props.className,
      )}
    />
  );
}

export function Drawer(props: DialogProps) {
  return (
    <Dialog
      {...props}
      className={cn(
        'drawer fixed inset-y-0 right-0 left-auto h-dvh w-full max-w-xl bg-white shadow-2xl ring-1 ring-zinc-900/5 sm:w-[36rem]',
        props.className,
      )}
    />
  );
}
