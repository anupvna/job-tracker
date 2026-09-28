import type { AuthUser } from '@job-tracker/shared';
import { LogOut, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useLogout } from '../hooks/useAuth';
import { Button } from './ui/Button';

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function Header({ user, onAdd }: { user: AuthUser; onAdd: () => void }) {
  const logout = useLogout();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="size-9" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Job Tracker</h1>
          <p className="text-sm text-zinc-500">
            Applications, referrals and follow-ups in one place.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={onAdd}>
          <Plus className="size-4" aria-hidden />
          Add application
          <kbd className="kbd ml-1 hidden sm:inline-flex">N</kbd>
        </Button>

        <div className="ml-1 flex items-center gap-2 border-l border-zinc-200 pl-3">
          <div
            className="flex size-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white"
            aria-hidden
          >
            {initials(user.name)}
          </div>
          <div className="hidden text-sm leading-tight md:block">
            <div className="font-medium text-zinc-900">{user.name}</div>
            <div className="text-xs text-zinc-500">{user.isDemo ? 'Demo sandbox' : user.email}</div>
          </div>
          <button
            type="button"
            title="Sign out"
            aria-label="Sign out"
            onClick={() =>
              logout.mutate(undefined, { onSuccess: () => toast.success('Signed out') })
            }
            className="inline-flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
