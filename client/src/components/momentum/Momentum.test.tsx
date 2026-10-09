import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays, todayISO } from '../../lib/dates';
import { MomentumCard } from './MomentumCard';

const today = todayISO();
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });

function setup(activity: unknown[], progress: unknown[] = [], apps: unknown[] = []) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith('/api/activity')) return json(activity);
    if (url.startsWith('/api/goals')) return json({ targetDate: addDays(today, 100), weeklyProblems: 10, weeklyApplications: 5, weeklyReferrals: 2, isDefault: true });
    if (url.startsWith('/api/study-plans')) return json({ plan: null, progress });
    if (url.startsWith('/api/applications')) return json(apps);
    return json({});
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MomentumCard />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('MomentumCard', () => {
  it('shows the streak, goal countdown and heatmap totals', async () => {
    setup([
      { day: addDays(today, -2), solves: 2, reviews: 0 },
      { day: addDays(today, -1), solves: 1, reviews: 1 },
      { day: today, solves: 0, reviews: 3 },
    ]);
    expect(await screen.findByText('Done for today · longest 3')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /3 problems solved and 4 revisions across 3 active days/ })).toBeInTheDocument();
  });

  it('nudges to keep a streak alive and counts this week against targets', async () => {
    const solvedOn = today;
    setup(
      [{ day: addDays(today, -1), solves: 1, reviews: 0 }],
      [{ slug: 'two-sum', solvedOn, rating: 'ok', reviewStage: 0, nextReviewOn: null, lastReviewedOn: null, reviewCount: 0 }],
      [
        { id: '1', company: 'A', role: 'SWE', link: null, status: 'applied', appliedDate: today, followUpDate: null, notes: '', referralName: null, referralStatus: 'not_asked', createdAt: '', updatedAt: '' },
        { id: '2', company: 'B', role: 'SWE', link: null, status: 'wishlist', appliedDate: today, followUpDate: null, notes: '', referralName: null, referralStatus: 'not_asked', createdAt: '', updatedAt: '' },
        { id: '3', company: 'C', role: 'SWE', link: null, status: 'interviewing', appliedDate: today, followUpDate: null, notes: '', referralName: 'Priya', referralStatus: 'referred', createdAt: '', updatedAt: '' },
      ],
    );
    expect(await screen.findByText(/to keep it going/)).toBeInTheDocument();
    const problems = await screen.findByRole('progressbar', { name: 'Problems this week' });
    expect(problems).toHaveAttribute('aria-valuenow', '1');
    const region = within(screen.getByRole('region', { name: 'Momentum' }));
    expect(region.getByRole('progressbar', { name: 'Applications this week' })).toHaveAttribute('aria-valuenow', '2');
    const referred = region.getByRole('progressbar', { name: 'With referral this week' });
    expect(referred).toHaveAttribute('aria-valuenow', '1');
    expect(referred).toHaveAttribute('aria-valuemax', '2');
    expect(region.getByRole('button', { name: /edit targets/i })).toBeInTheDocument();
  });
});
