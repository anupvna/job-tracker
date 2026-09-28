import type { Application } from '@job-tracker/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationsTable } from './ApplicationsTable';

const TODAY = '2026-09-28';

function makeApp(overrides: Partial<Application>): Application {
  return {
    id: crypto.randomUUID(),
    company: 'Acme',
    role: 'Software Engineer',
    link: null,
    status: 'applied',
    appliedDate: '2026-09-01',
    followUpDate: null,
    notes: '',
    referralName: null,
    referralStatus: 'not_asked',
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

function renderTable(
  rows: Application[],
  handlers: Partial<Parameters<typeof ApplicationsTable>[0]> = {},
) {
  return render(
    <ApplicationsTable
      rows={rows}
      today={TODAY}
      sort="updatedAt"
      order="desc"
      onSort={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onStatusChange={vi.fn()}
      {...handlers}
    />,
  );
}

describe('ApplicationsTable', () => {
  it('highlights overdue follow-ups but not closed applications', () => {
    renderTable([
      makeApp({ company: 'Late Co', followUpDate: '2026-09-25' }),
      makeApp({ company: 'Future Co', followUpDate: '2026-10-10' }),
      makeApp({ company: 'Closed Co', followUpDate: '2026-09-01', status: 'rejected' }),
    ]);

    const table = within(screen.getByRole('table'));
    const row = (name: string) => table.getByRole('button', { name }).closest('tr')!;
    expect(row('Late Co')).toHaveAttribute('data-overdue', 'true');
    expect(within(row('Late Co')).getByText('3 days overdue')).toBeInTheDocument();
    expect(row('Future Co')).not.toHaveAttribute('data-overdue');
    expect(row('Closed Co')).not.toHaveAttribute('data-overdue');
  });

  it('changes status inline without opening the editor', () => {
    const onStatusChange = vi.fn();
    const onEdit = vi.fn();
    const app = makeApp({ company: 'Stripe' });
    renderTable([app], { onStatusChange, onEdit });

    fireEvent.change(within(screen.getByRole('table')).getByLabelText('Status for Stripe'), {
      target: { value: 'interviewing' },
    });
    expect(onStatusChange).toHaveBeenCalledWith(app, 'interviewing');
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('sorts when a column header is clicked', () => {
    const onSort = vi.fn();
    renderTable([makeApp({})], { onSort });
    fireEvent.click(screen.getByRole('button', { name: /follow-up/i }));
    expect(onSort).toHaveBeenCalledWith('followUpDate');
  });

  it('asks before deleting via the row action', () => {
    const onDelete = vi.fn();
    const onEdit = vi.fn();
    const app = makeApp({ company: 'Figma' });
    renderTable([app], { onDelete, onEdit });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Figma' }));
    expect(onDelete).toHaveBeenCalledWith(app);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('renders a card list for small screens with the same overdue flag', () => {
    renderTable([makeApp({ company: 'Late Co', followUpDate: '2026-09-25' })]);
    const card = screen.getByRole('list').querySelector('li')!;
    expect(card).toHaveAttribute('data-overdue', 'true');
    expect(within(card).getByText('Late Co')).toBeInTheDocument();
  });
});
