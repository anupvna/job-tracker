import { Plus } from 'lucide-react';
import { Button } from './ui/Button';

/** Title row for the Applications page. Account controls live in the AppShell top bar. */
export function Header({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-sm text-zinc-500">Applications, referrals and follow-ups in one place.</p>
      </div>
      <Button variant="primary" onClick={onAdd}>
        <Plus className="size-4" aria-hidden />
        Add application
        <kbd className="kbd ml-1 hidden sm:inline-flex">N</kbd>
      </Button>
    </div>
  );
}
