import { LoaderCircle } from 'lucide-react';
import { useMe } from './hooks/useAuth';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';

/** Top-level gate: signed-in users get their dashboard, everyone else the sign-in page. */
export function App() {
  const me = useMe();

  if (me.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <LoaderCircle className="size-6 animate-spin text-zinc-400" aria-label="Loading" />
      </div>
    );
  }

  // `key` remounts the dashboard on account switch so no state leaks between users.
  return me.data ? <Dashboard key={me.data.id} user={me.data} /> : <AuthPage />;
}
