import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Application } from '@job-tracker/shared';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationForm } from './ApplicationForm';
import { ApplicationsTable } from './ApplicationsTable';
import { JobPostingPanel } from './JobPostingPanel';

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const ID = '11111111-1111-4111-8111-111111111111';

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

afterEach(() => vi.restoreAllMocks());

describe('Autofill from link', () => {
  it('only offers autofill for supported job boards, and fills company and role', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({
        supported: true,
        status: 'open',
        posting: { source: 'greenhouse', company: 'Stripe', title: 'Software Engineer, New Grad', location: 'NYC', description: 'x', postedAt: null, url: null },
      }),
    );
    wrap(<ApplicationForm onSubmit={async () => {}} onCancel={() => {}} />);
    const link = screen.getByLabelText('Job posting link');

    fireEvent.change(link, { target: { value: 'https://www.linkedin.com/jobs/view/1' } });
    expect(screen.queryByRole('button', { name: /autofill/i })).not.toBeInTheDocument();

    fireEvent.change(link, { target: { value: 'https://boards.greenhouse.io/stripe/jobs/8172487' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Autofill from Greenhouse' }));

    await waitFor(() => expect(screen.getByLabelText(/^Company/)).toHaveValue('Stripe'));
    expect(screen.getByLabelText(/^Role/)).toHaveValue('Software Engineer, New Grad');
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/job-postings/lookup');
    expect(JSON.parse(String(init?.body))).toEqual({ url: 'https://boards.greenhouse.io/stripe/jobs/8172487' });
  });
});

describe('JobPostingPanel', () => {
  it('shows the saved description and that the posting closed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({
        applicationId: ID, source: 'greenhouse', title: 'SWE I', company: 'Datadog', location: 'NYC',
        description: 'Build pipelines.\n\n• Go', postedAt: null, fetchedAt: '2026-10-01T00:00:00Z',
        postingStatus: 'closed', lastCheckedAt: '2026-10-08T00:00:00Z', closedAt: '2026-10-08T00:00:00Z',
      }),
    );
    wrap(<JobPostingPanel applicationId={ID} link="https://boards.greenhouse.io/datadog/jobs/1" />);
    expect(await screen.findByText(/Posting closed/)).toBeInTheDocument();
    expect(screen.getByText(/Build pipelines\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh copy' })).toBeInTheDocument();
  });

  it('lets you paste a description for unsupported sites', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (init?.method === 'PUT') return json({ applicationId: ID, source: 'manual', description: 'Pasted text', postingStatus: 'unknown', fetchedAt: '2026-10-09T00:00:00Z', title: null, company: null, location: null, postedAt: null, lastCheckedAt: null, closedAt: null });
      return json({ error: { code: 'NOT_FOUND', message: 'No saved posting' } }, 404);
    });
    wrap(<JobPostingPanel applicationId={ID} link="https://www.linkedin.com/jobs/view/1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Paste description' }));
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: 'Pasted text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save description' }));
    await waitFor(() => {
      const put = fetchSpy.mock.calls.find(([, i]) => i?.method === 'PUT');
      expect(put?.[0]).toBe(`/api/applications/${ID}/snapshot`);
      expect(JSON.parse(String(put?.[1]?.body))).toEqual({ description: 'Pasted text' });
    });
  });
});

describe('Posting closed badge', () => {
  it('appears on applications whose posting was taken down', () => {
    const app: Application = {
      id: ID, company: 'Datadog', role: 'SWE I', link: null, status: 'applied', appliedDate: null,
      followUpDate: null, notes: '', referralName: null, referralStatus: 'not_asked',
      createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
    };
    const postings = new Map([[ID, { applicationId: ID, source: 'greenhouse' as const, postingStatus: 'closed' as const, fetchedAt: '', lastCheckedAt: null, closedAt: null }]]);
    render(
      <ApplicationsTable rows={[app]} today="2026-10-09" sort="company" order="asc" onSort={() => {}} onEdit={() => {}} onDelete={() => {}} onStatusChange={() => {}} postings={postings} />,
    );
    expect(screen.getAllByText('Posting closed').length).toBeGreaterThan(0);
  });
});
