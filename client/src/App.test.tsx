import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { isKnownPath, routeFromPath } from './lib/router';

const USER = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', isDemo: false, expiresAt: null };
const STATS = {
  total: 0,
  byStatus: { wishlist: 0, applied: 0, interviewing: 0, offer: 0, rejected: 0 },
  overdueFollowUps: 0,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Minimal fake API: signed in, with an empty tracker. */
function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith('/api/auth/me')) return json(USER);
    if (url.startsWith('/api/applications/stats')) return json(STATS);
    if (url.startsWith('/api/applications')) return json([]);
    if (url.startsWith('/api/tasks/counts')) return json({ today: 0, overdue: 0, upcoming: 0, someday: 0 });
    if (url.startsWith('/api/tasks')) return json([]);
    return json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  });
}

function renderApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>,
  );
}

/** Both navs render in jsdom (CSS breakpoints don't apply); use the first. */
const mainNav = () => screen.getAllByRole('navigation', { name: 'Main' })[0]!;

beforeEach(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('router helpers', () => {
  it('maps paths to pages, falling back to Applications', () => {
    expect(routeFromPath('/')).toBe('applications');
    expect(routeFromPath('/prep')).toBe('prep');
    expect(routeFromPath('/prep/')).toBe('prep');
    expect(routeFromPath('/something-else')).toBe('applications');
    expect(isKnownPath('/prep')).toBe(true);
    expect(isKnownPath('/nope')).toBe(false);
  });
});

describe('App navigation', () => {
  it('opens on Applications and switches to Prep and back', async () => {
    mockApi();
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Applications', level: 1 })).toBeInTheDocument();
    expect(within(mainNav()).getByRole('link', { name: 'Applications' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    fireEvent.click(within(mainNav()).getByRole('link', { name: 'Prep' }));
    expect(await screen.findByRole('heading', { name: 'Prep', level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/prep');
    expect(document.title).toBe('Prep · Job Tracker');
    expect(within(mainNav()).getByRole('link', { name: 'Prep' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // Browser Back returns to Applications.
    act(() => {
      window.history.back();
    });
    await act(() => new Promise((r) => setTimeout(r, 0)));
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByRole('heading', { name: 'Applications', level: 1 })).toBeInTheDocument();
  });

  it('loads Prep directly from its URL (deep link / refresh)', async () => {
    window.history.replaceState(null, '', '/prep');
    mockApi();
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Prep', level: 1 })).toBeInTheDocument();
    // The Prep tab must not touch application data.
    expect(screen.queryByRole('button', { name: /add application/i })).not.toBeInTheDocument();
  });

  it('keeps filter query params on Applications and tidies unknown paths', async () => {
    window.history.replaceState(null, '', '/unknown?status=applied');
    mockApi();
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Applications', level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toContain('status=applied');
  });

  it('lets Cmd/Ctrl-click open a tab in a new window instead of navigating', async () => {
    mockApi();
    renderApp();
    await screen.findByRole('heading', { name: 'Applications', level: 1 });
    const prep = within(mainNav()).getByRole('link', { name: 'Prep' });
    expect(prep).toHaveAttribute('href', '/prep');
    // Record whether our handler cancelled the click, then stop jsdom's own navigation.
    let cancelledByApp: boolean | undefined;
    const observe = (e: Event) => {
      cancelledByApp = e.defaultPrevented;
      e.preventDefault();
    };
    document.addEventListener('click', observe);
    fireEvent.click(prep, { metaKey: true });
    document.removeEventListener('click', observe);
    expect(cancelledByApp).toBe(false);
    expect(window.location.pathname).toBe('/');
  });

  it('shows the sign-in page, not the app shell, when signed out', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in' } }, 401),
    );
    renderApp();
    expect(await screen.findByRole('tab', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });
});
