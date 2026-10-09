import { LoaderCircle } from 'lucide-react';
import { AppShell } from './components/AppShell';
import { useMe } from './hooks/useAuth';
import { useRoute } from './lib/router';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { PrepPage } from './pages/PrepPage';

/** Top-level gate: signed-in users get the app shell, everyone else the sign-in page. */
export function App() {
  const me = useMe();
  const route = useRoute();

  if (me.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <LoaderCircle className="size-6 animate-spin text-zinc-400" aria-label="Loading" />
      </div>
    );
  }

  if (!me.data) return <AuthPage />;

  // `key` remounts the signed-in tree on account switch so no state leaks between users.
  return (
    <AppShell key={me.data.id} user={me.data} route={route}>
      {route === 'prep' ? <PrepPage /> : <Dashboard />}
    </AppShell>
  );
}
