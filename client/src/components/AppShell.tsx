import type { AuthUser } from '@job-tracker/shared';
import { Briefcase, LogOut, Target, type LucideIcon } from 'lucide-react';
import { useEffect, type MouseEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useLogout } from '../hooks/useAuth';
import { cn } from '../lib/cn';
import {
  ROUTE_PATHS,
  ROUTE_SECTION,
  ROUTE_TITLES,
  isKnownPath,
  navigate,
  type Route,
} from '../lib/router';
import { DemoBanner } from './DemoBanner';

const NAV: { route: Route; icon: LucideIcon }[] = [
  { route: 'applications', icon: Briefcase },
  { route: 'prep', icon: Target },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Client-side navigation that still lets Cmd/Ctrl-click open a new tab. */
function onNavClick(e: MouseEvent<HTMLAnchorElement>, route: Route) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(route);
}

/** Signed-in layout: top bar (desktop tabs), page content, and a bottom tab bar on phones. */
export function AppShell({
  user,
  route,
  children,
}: {
  user: AuthUser;
  route: Route;
  children: ReactNode;
}) {
  const logout = useLogout();

  useEffect(() => {
    document.title = `${ROUTE_TITLES[route]} · Job Tracker`;
  }, [route]);

  // Tidy unknown paths (e.g. /foo) back to "/" without losing filter query params.
  useEffect(() => {
    if (!isKnownPath(window.location.pathname)) {
      window.history.replaceState(null, '', ROUTE_PATHS[route] + window.location.search);
    }
  }, [route]);

  return (
    <div className="min-h-dvh pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <a
            href={ROUTE_PATHS.applications}
            onClick={(e) => onNavClick(e, 'applications')}
            className="flex items-center gap-2.5 rounded-md"
          >
            <img src="/favicon.svg" alt="" className="size-7" />
            <span className="font-semibold tracking-tight">Job Tracker</span>
          </a>

          <nav aria-label="Main" className="hidden h-full items-stretch gap-1 sm:flex">
            {NAV.map(({ route: r, icon: Icon }) => {
              const active = r === ROUTE_SECTION[route];
              return (
                <a
                  key={r}
                  href={ROUTE_PATHS[r]}
                  onClick={(e) => onNavClick(e, r)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center gap-2 px-3 text-sm font-medium transition-colors',
                    'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full',
                    active
                      ? 'text-zinc-900 after:bg-zinc-900'
                      : 'text-zinc-500 after:bg-transparent hover:text-zinc-900',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {ROUTE_TITLES[r]}
                </a>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div
              className="flex size-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white"
              aria-hidden
            >
              {initials(user.name)}
            </div>
            <div className="hidden text-sm leading-tight md:block">
              <div className="font-medium text-zinc-900">{user.name}</div>
              <div className="text-xs text-zinc-500">
                {user.isDemo ? 'Demo sandbox' : user.email}
              </div>
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

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {user.isDemo && user.expiresAt && <DemoBanner expiresAt={user.expiresAt} />}
        {children}
      </div>

      {/* Phone tab bar — thumb-reachable, respects the iPhone home indicator. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      >
        <div className="grid h-16 grid-cols-2">
          {NAV.map(({ route: r, icon: Icon }) => {
            const active = r === ROUTE_SECTION[route];
            return (
              <a
                key={r}
                href={ROUTE_PATHS[r]}
                onClick={(e) => onNavClick(e, r)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-zinc-900' : 'text-zinc-400',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                    active && 'bg-zinc-100',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {ROUTE_TITLES[r]}
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
