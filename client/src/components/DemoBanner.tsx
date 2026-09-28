import { FlaskConical } from 'lucide-react';
import { useLogout } from '../hooks/useAuth';

function hoursLeft(expiresAt: string) {
  return Math.max(1, Math.round((Date.parse(expiresAt) - Date.now()) / 3_600_000));
}

/** Shown in demo sandboxes: explains the data is temporary and nudges toward a real account. */
export function DemoBanner({ expiresAt }: { expiresAt: string }) {
  const logout = useLogout();
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center">
      <FlaskConical className="size-4 shrink-0 text-amber-600" aria-hidden />
      <p className="flex-1">
        <strong className="font-semibold">You’re in a private demo.</strong> Try anything — edit,
        delete, add. This sandbox and its data are deleted in about {hoursLeft(expiresAt)}h.
      </p>
      <button
        type="button"
        onClick={() => {
          window.location.hash = 'signup';
          logout.mutate();
        }}
        className="self-start font-semibold whitespace-nowrap underline-offset-2 hover:underline sm:self-auto"
      >
        Create your own account →
      </button>
    </div>
  );
}
