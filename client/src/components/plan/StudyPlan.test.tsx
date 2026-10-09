import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NEETCODE_150 } from '@job-tracker/shared';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays, todayISO } from '../../lib/dates';
import { NeetcodePage } from '../../pages/NeetcodePage';
import { StudyPlanCard } from './StudyPlanCard';

const today = todayISO();
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function renderWith(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

type Calls = { url: string; method: string; body: unknown }[];

type P = { slug: string; solvedOn: string; [k: string]: unknown };
const full = (p: P) => ({ rating: 'ok', reviewStage: 0, nextReviewOn: null, lastReviewedOn: null, reviewCount: 0, ...p });

function mockApi(state: { plan: unknown; progress: P[] }) {
  state.progress = state.progress.map(full);
  const calls: Calls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    if (url === '/api/study-plans/neetcode150' && method === 'GET') return json(state);
    if (url === '/api/study-plans/neetcode150' && method === 'PUT') {
      state.plan = { planKey: 'neetcode150', ...body, createdAt: '', updatedAt: '' };
      return json(state.plan);
    }
    if (url.startsWith('/api/progress/') && !url.endsWith('/review')) {
      const slug = url.split('/').pop()!;
      state.progress = state.progress.filter((p) => p.slug !== slug);
      if (body.solved) state.progress.push(full({ slug, solvedOn: body.solvedOn, rating: body.rating ?? 'ok', nextReviewOn: addDays(body.solvedOn, 1) }));
      return body.solved ? json(state.progress.at(-1)) : new Response(null, { status: 204 });
    }
    if (url === '/api/study-plans/neetcode150' && method === 'DELETE') {
      state.plan = null;
      return new Response(null, { status: 204 });
    }
    if (url === '/api/progress' && method === 'DELETE') {
      const problems = state.progress.length;
      state.progress = [];
      return json({ problems, reviews: 0 });
    }
    if (url.startsWith('/api/progress/') && url.endsWith('/review')) {
      const slug = url.split('/')[3]!;
      const p = state.progress.find((x) => x.slug === slug)!;
      Object.assign(p, { reviewCount: (p as { reviewCount?: number }).reviewCount! + 1, lastReviewedOn: body.reviewedOn, nextReviewOn: addDays(body.reviewedOn, 3), reviewStage: 1 });
      return json(p);
    }
    return json({});
  });
  return calls;
}

const plan = (over: Record<string, unknown> = {}) => ({
  planKey: 'neetcode150',
  pace: 'low',
  studyDays: EVERY_DAY,
  startDate: today,
  createdAt: '',
  updatedAt: '',
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('StudyPlanCard', () => {
  it('offers to set up a plan and saves the chosen pace', async () => {
    const calls = mockApi({ plan: null, progress: [] });
    renderWith(<StudyPlanCard />);

    fireEvent.click(await screen.findByRole('button', { name: /set up my plan/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: /high/i }));
    expect(within(dialog).getByText(/finish around/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start plan' }));

    await waitFor(() => {
      const put = calls.find((c) => c.method === 'PUT');
      expect(put?.body).toEqual({ pace: 'high', studyDays: [1, 2, 3, 4, 5, 6], startDate: today });
    });
  });

  it("shows today's problems and ticks one off", async () => {
    const calls = mockApi({ plan: plan(), progress: [] });
    renderWith(<StudyPlanCard />);

    expect(await screen.findByText('Day 1', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('0/2 done')).toBeInTheDocument();
    const first = NEETCODE_150[0]!;
    fireEvent.click(screen.getByRole('checkbox', { name: `Mark “${first.title}” as solved` }));

    await waitFor(() => expect(screen.getByText('1/2 done')).toBeInTheDocument());
    expect(calls.find((c) => c.method === 'PUT')).toEqual({
      url: `/api/progress/${first.slug}`,
      method: 'PUT',
      body: { solved: true, solvedOn: today },
    });
  });

  it('shows how far behind a plan is after missed days', async () => {
    mockApi({ plan: plan({ startDate: addDays(today, -3) }), progress: [] });
    renderWith(<StudyPlanCard />);
    expect(await screen.findByText('6 behind')).toBeInTheDocument();
    // Today is still just today's quota, not a pile of overdue problems.
    expect(screen.getByText('0/2 done')).toBeInTheDocument();
  });
  it('restarts the schedule from today when the pace changes, keeping progress', async () => {
    const calls = mockApi({
      plan: plan({ pace: 'medium', studyDays: [1, 2, 3, 4, 5, 6], startDate: addDays(today, -10) }),
      progress: [{ slug: 'two-sum', solvedOn: addDays(today, -9) }],
    });
    renderWith(<StudyPlanCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit plan' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: /high/i }));
    expect(within(dialog).getByText(/new pace starts today/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save plan' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
        pace: 'high',
        studyDays: [1, 2, 3, 4, 5, 6],
        startDate: today,
      }),
    );
    expect(calls.some((c) => c.url.startsWith('/api/progress'))).toBe(false);
  });
});

describe('revision', () => {
  it("shows due reviews with the gap since solving and logs a rating", async () => {
    const calls = mockApi({
      plan: plan(),
      progress: [{ slug: 'two-sum', solvedOn: addDays(today, -7), reviewStage: 2, nextReviewOn: today }],
    });
    renderWith(<StudyPlanCard />);
    expect(await screen.findByText('1 due')).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /It’s been 1 week since you solved Two Sum — revise it\./.test(el.textContent ?? '')),
    ).toBeInTheDocument();
    const group = screen.getByRole('group', { name: /after revising/i });
    fireEvent.click(within(group).getByRole('button', { name: 'Easy' }));
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith('/review'))).toEqual({
        url: '/api/progress/two-sum/review',
        method: 'POST',
        body: { rating: 'easy', reviewedOn: today },
      }),
    );
    await waitFor(() => expect(screen.queryByText('1 due')).not.toBeInTheDocument());
  });

  it('lets you rate a problem you just solved', async () => {
    const calls = mockApi({ plan: plan(), progress: [] });
    renderWith(<StudyPlanCard />);
    const first = NEETCODE_150[0]!;
    fireEvent.click(await screen.findByRole('checkbox', { name: `Mark “${first.title}” as solved` }));
    const chips = await screen.findByRole('group', { name: 'How was it?' });
    fireEvent.click(within(chips).getByRole('button', { name: 'Hard' }));
    await waitFor(() =>
      expect(calls.filter((c) => c.method === 'PUT').at(-1)?.body).toEqual({ solved: true, solvedOn: today, rating: 'hard' }),
    );
  });
});

describe('stopping a plan', () => {
  async function stop(clear: boolean) {
    const state = { plan: plan(), progress: [{ slug: 'two-sum', solvedOn: today }] as P[] };
    const calls = mockApi(state);
    renderWith(<StudyPlanCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit plan' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /stop plan/i }));
    const confirm = await screen.findByRole('dialog', { name: /stop your neetcode 150 plan/i });
    if (clear) fireEvent.click(within(confirm).getByRole('checkbox', { name: /also clear my progress/i }));
    fireEvent.click(within(confirm).getByRole('button', { name: clear ? 'Stop and clear' : 'Stop plan' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    await screen.findByRole('button', { name: /set up my plan/i });
    return { calls, state };
  }

  it('keeps solved problems by default', async () => {
    const { calls, state } = await stop(false);
    expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.url)).toEqual(['/api/study-plans/neetcode150']);
    expect(state.progress).toHaveLength(1);
  });

  it('can also clear progress', async () => {
    const { calls, state } = await stop(true);
    await waitFor(() =>
      expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.url)).toEqual([
        '/api/study-plans/neetcode150',
        '/api/progress',
      ]),
    );
    expect(state.progress).toEqual([]);
  });
});

describe('NeetcodePage', () => {
  it('lists all 18 topics with per-topic progress', async () => {
    mockApi({ plan: null, progress: [{ slug: 'two-sum', solvedOn: today }] });
    renderWith(<NeetcodePage />);
    expect(await screen.findByText('Arrays & Hashing')).toBeInTheDocument();
    expect(screen.getByText('Math & Geometry')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(18);
    await waitFor(() => expect(screen.getByText('1/9')).toBeInTheDocument());
    expect(screen.getAllByRole('checkbox', { name: /as solved/ })).toHaveLength(150);
  });

  it('hides solved problems on request', async () => {
    mockApi({ plan: null, progress: [{ slug: 'two-sum', solvedOn: today }] });
    renderWith(<NeetcodePage />);
    await screen.findByText('1/9');
    fireEvent.click(screen.getByLabelText('Hide solved'));
    expect(screen.getAllByRole('checkbox', { name: /as solved/ })).toHaveLength(149);
  });
});
