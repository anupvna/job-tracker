import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, todayISO } from '../lib/dates';
import { PrepPage } from './PrepPage';

const today = todayISO();

function task(over: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    title: 'Task',
    notes: '',
    dueDate: today,
    priority: 'none',
    tags: [],
    doneAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...over,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type Handler = (url: string, init?: RequestInit) => Response | undefined;

/** Fake API. `extra` can intercept specific calls; everything else gets sensible defaults. */
function mockApi(data: { tasks?: unknown[]; apps?: unknown[] }, extra?: Handler) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const hit = extra?.(url, init);
    if (hit) return hit;
    if (url.startsWith('/api/tasks/counts')) return json({ today: data.tasks?.length ?? 0, overdue: 0, upcoming: 0, someday: 0 });
    if (url.startsWith('/api/tasks?')) return json(url.includes('view=today') ? (data.tasks ?? []) : []);
    if (url.startsWith('/api/applications')) return json(data.apps ?? []);
    if (url.startsWith('/api/activity')) return json([]);
    if (url.startsWith('/api/goals')) return json({ targetDate: '2027-05-01', weeklyProblems: 15, weeklyApplications: 10, isDefault: true });
    if (url.startsWith('/api/study-plans')) return json({ plan: null, progress: [] });
    return json({}, 200);
  });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PrepPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => window.history.replaceState(null, '', '/prep'));
afterEach(() => vi.restoreAllMocks());

describe('PrepPage', () => {
  it('quick-adds a task with parsed date, tags and priority', async () => {
    let posted: unknown;
    mockApi({}, (url, init) => {
      if (url === '/api/tasks' && init?.method === 'POST') {
        posted = JSON.parse(String(init.body));
        return json(task({ ...(posted as object) }), 201);
      }
    });
    renderPage();

    const input = screen.getByLabelText('Add a task');
    fireEvent.change(input, { target: { value: 'LC 2 mediums tomorrow #dsa !high' } });
    // Live preview before saving.
    expect(screen.getByText('“LC 2 mediums”')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();

    fireEvent.submit(input.closest('form')!);
    await waitFor(() =>
      expect(posted).toEqual({
        title: 'LC 2 mediums',
        notes: '',
        dueDate: addDays(today, 1),
        priority: 'high',
        tags: ['dsa'],
      }),
    );
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('groups overdue and today tasks and completes one', async () => {
    const overdue = task({ title: 'Update resume', dueDate: addDays(today, -2) });
    const now = task({ title: 'Solve 2 mediums', priority: 'high' });
    let patched: { url: string; body: unknown } | undefined;
    const open = [overdue, now];
    mockApi({ tasks: open }, (url, init) => {
      if (init?.method === 'PATCH') {
        patched = { url, body: JSON.parse(String(init.body)) };
        open.splice(open.indexOf(now), 1); // the server now considers it done
        return json({ ...now, doneAt: new Date().toISOString() });
      }
    });
    renderPage();

    expect(await screen.findByText('Overdue · 1')).toBeInTheDocument();
    expect(screen.getByText('Today · 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete “Solve 2 mediums”' }));
    await waitFor(() => expect(patched).toEqual({ url: `/api/tasks/${now.id}`, body: { done: true } }));
    // Optimistically removed from the list.
    await waitFor(() => expect(screen.queryByText('Solve 2 mediums')).not.toBeInTheDocument());
  });

  it('pulls due job follow-ups from the tracker into Today', async () => {
    const app = (company: string, followUpDate: string, status = 'applied') => ({
      id: crypto.randomUUID(), company, role: 'SWE', link: null, status, appliedDate: null,
      followUpDate, notes: '', referralName: null, referralStatus: 'not_asked',
      createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
    });
    mockApi({
      apps: [
        app('Datadog', addDays(today, -1)),
        app('Stripe', today),
        app('Figma', addDays(today, 5)), // not due yet
        app('Meta', addDays(today, -3), 'rejected'), // closed
      ],
    });
    renderPage();

    const section = await screen.findByRole('region', { name: /job follow-ups/i });
    expect(within(section).getByText('Datadog')).toBeInTheDocument();
    expect(within(section).getByText('Stripe')).toBeInTheDocument();
    expect(within(section).queryByText('Figma')).not.toBeInTheDocument();
    expect(within(section).queryByText('Meta')).not.toBeInTheDocument();
  });

  it('switches views and remembers the view in the URL', async () => {
    mockApi({});
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /someday/i }));
    expect(await screen.findByText('No someday ideas')).toBeInTheDocument();
    expect(window.location.search).toBe('?view=someday');
  });
});
