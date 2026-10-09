import { LoaderCircle } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { AppShell } from './components/AppShell';
import { useMe } from './hooks/useAuth';
import { useRoute } from './lib/router';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';

// Prep pages (planner, NeetCode list) load on demand so the tracker's first paint stays small.
const PrepPage = lazy(() => import('./pages/PrepPage').then((m) => ({ default: m.PrepPage })));
const NeetcodePage = lazy(() =>
  import('./pages/NeetcodePage').then((m) => ({ default: m.NeetcodePage })),
);

function Spinner() {
  return (
    <div className="flex min-h-[40dvh] items-center justify-center" aria-busy="true">
      <LoaderCircle className="size-6 animate-spin text-zinc-400" aria-label="Loading" />
    </div>
  );
}

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
      <Suspense fallback={<Spinner />}>
        {route === 'prep' ? <PrepPage /> : route === 'neetcode' ? <NeetcodePage /> : <Dashboard />}
      </Suspense>
    </AppShell>
  );
}
