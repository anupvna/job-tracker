import { Plus } from 'lucide-react';
import { Button } from './ui/Button';

export function Header({ onAdd }: { onAdd: () => void }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="size-9" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Job Tracker</h1>
          <p className="text-sm text-zinc-500">
            Applications, referrals and follow-ups in one place.
          </p>
        </div>
      </div>
      <Button variant="primary" onClick={onAdd}>
        <Plus className="size-4" aria-hidden />
        Add application
        <kbd className="kbd ml-1 hidden sm:inline-flex">N</kbd>
      </Button>
    </header>
  );
}
