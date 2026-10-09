import { useSyncExternalStore } from 'react';

/**
 * A deliberately tiny router: the app has two top-level pages, so a dependency
 * like react-router would be overkill. Paths are real URLs (no hash), which the
 * Express server and the Vercel config both already fall back to index.html for.
 */
export type Route = 'applications' | 'prep' | 'neetcode';

export const ROUTE_PATHS: Record<Route, string> = {
  applications: '/',
  prep: '/prep',
  neetcode: '/prep/neetcode150',
};

export const ROUTE_TITLES: Record<Route, string> = {
  applications: 'Applications',
  prep: 'Prep',
  neetcode: 'NeetCode 150',
};

/** Which top-level tab a page belongs to (sub-pages light up their parent tab). */
export const ROUTE_SECTION: Record<Route, Route> = {
  applications: 'applications',
  prep: 'prep',
  neetcode: 'prep',
};

/** Map a pathname to a page. Anything unknown falls back to Applications. */
export function routeFromPath(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  const match = (Object.keys(ROUTE_PATHS) as Route[]).find((r) => ROUTE_PATHS[r] === path);
  return match ?? 'applications';
}

/** True when `pathname` is exactly one of our canonical paths. */
export function isKnownPath(pathname: string): boolean {
  return Object.values(ROUTE_PATHS).includes(pathname);
}

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('popstate', onChange);
  };
}

const getPathname = () => window.location.pathname;

/** Go to a page, adding a browser-history entry so Back works. */
export function navigate(route: Route) {
  const path = ROUTE_PATHS[route];
  if (window.location.pathname === path) return;
  window.history.pushState(null, '', path);
  listeners.forEach((notify) => notify());
  window.scrollTo({ top: 0 });
}

/** The current page; re-renders on navigate() and on browser Back/Forward. */
export function useRoute(): Route {
  return routeFromPath(useSyncExternalStore(subscribe, getPathname));
}
