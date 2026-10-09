import {
  STATUS_LABELS,
  type Application,
  type ApplicationStatus,
  type CreateApplication,
} from '@job-tracker/shared';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ApplicationForm } from '../components/ApplicationForm';
import { ApplicationsTable } from '../components/ApplicationsTable';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { Header } from '../components/Header';
import { EmptyState, ErrorState, NoResults, TableSkeleton } from '../components/States';
import { StatusSummary } from '../components/StatusSummary';
import { Toolbar } from '../components/Toolbar';
import { Drawer } from '../components/ui/Dialog';
import {
  useApplicationStats,
  useApplicationsList,
  useCreateApplication,
  useDeleteApplication,
  useLoadSampleData,
  useUpdateApplication,
} from '../hooks/useApplications';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useFilters } from '../hooks/useFilters';
import { useHotkey } from '../hooks/useHotkey';
import { todayISO } from '../lib/dates';

type DrawerState = { mode: 'create' } | { mode: 'edit'; app: Application } | null;

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Something went wrong';

export function Dashboard() {
  const { filters, update, toggleSort, reset, isFiltered } = useFilters();

  // Search box is local state; the query only fires once typing pauses.
  const [search, setSearch] = useState(filters.q ?? '');
  const debouncedSearch = useDebouncedValue(search);
  useEffect(() => update({ q: debouncedSearch.trim() || undefined }), [debouncedSearch, update]);

  const list = useApplicationsList(filters);
  const stats = useApplicationStats();
  const createMutation = useCreateApplication();
  const updateMutation = useUpdateApplication();
  const deleteMutation = useDeleteApplication();
  const sampleMutation = useLoadSampleData();

  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);

  const openCreate = useCallback(() => setDrawer({ mode: 'create' }), []);
  useHotkey('n', openCreate);

  const today = todayISO();
  const rows = list.data ?? [];
  const trackerIsEmpty = stats.data?.total === 0 && !isFiltered;

  async function handleSubmit(values: CreateApplication) {
    try {
      if (drawer?.mode === 'edit') {
        await updateMutation.mutateAsync({ id: drawer.app.id, patch: values });
        toast.success('Changes saved');
      } else {
        const created = await createMutation.mutateAsync(values);
        toast.success(`Added ${created.company}`);
      }
      setDrawer(null);
    } catch (err) {
      toast.error(errorMessage(err));
      throw err; // let the form map field errors
    }
  }

  function handleStatusChange(app: Application, status: ApplicationStatus) {
    updateMutation.mutate(
      { id: app.id, patch: { status } },
      {
        onSuccess: () => toast.success(`${app.company} → ${STATUS_LABELS[status]}`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteMutation.mutate(target.id, {
      onSuccess: () => toast.success(`Deleted ${target.company}`),
      onError: (err) => toast.error(errorMessage(err)),
    });
    setDeleteTarget(null);
    setDrawer(null);
  }

  function handleLoadSample() {
    sampleMutation.mutate(undefined, {
      onSuccess: ({ inserted }) => toast.success(`Loaded ${inserted} sample applications`),
      onError: (err) => toast.error(errorMessage(err)),
    });
  }

  function resetFilters() {
    setSearch('');
    reset();
  }

  let body: ReactNode;
  if (list.isPending) body = <TableSkeleton />;
  else if (list.isError)
    body = <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />;
  else if (trackerIsEmpty)
    body = (
      <EmptyState
        onAdd={openCreate}
        onLoadSample={handleLoadSample}
        loadingSample={sampleMutation.isPending}
      />
    );
  else if (rows.length === 0) body = <NoResults onReset={resetFilters} />;
  else
    body = (
      <ApplicationsTable
        rows={rows}
        today={today}
        sort={filters.sort}
        order={filters.order}
        onSort={toggleSort}
        onEdit={(app) => setDrawer({ mode: 'edit', app })}
        onDelete={setDeleteTarget}
        onStatusChange={handleStatusChange}
      />
    );

  return (
    <div className="space-y-6">
      <Header onAdd={openCreate} />

      <StatusSummary
        stats={stats.data}
        activeStatus={filters.status}
        overdueActive={Boolean(filters.overdue)}
        onSelectStatus={(status) => update({ status })}
        onToggleOverdue={() => update({ overdue: !filters.overdue || undefined })}
      />

      <main className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
        {!trackerIsEmpty && (
          <Toolbar
            search={search}
            onSearchChange={setSearch}
            status={filters.status}
            onStatusChange={(status) => update({ status })}
            overdue={Boolean(filters.overdue)}
            onOverdueChange={(v) => update({ overdue: v || undefined })}
            resultCount={list.data?.length}
            isFiltered={isFiltered}
            onReset={resetFilters}
          />
        )}
        <div
          className={
            list.isFetching && !list.isPending ? 'opacity-70 transition-opacity' : undefined
          }
        >
          {body}
        </div>
      </main>

      <footer className="pb-4 text-center text-xs text-zinc-400">
        React · TypeScript · Express · PostgreSQL
      </footer>

      <Drawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        labelledBy="application-form-title"
      >
        {drawer && (
          <ApplicationForm
            key={drawer.mode === 'edit' ? drawer.app.id : 'new'}
            initial={drawer.mode === 'edit' ? drawer.app : undefined}
            onSubmit={handleSubmit}
            onCancel={() => setDrawer(null)}
            onDelete={drawer.mode === 'edit' ? () => setDeleteTarget(drawer.app) : undefined}
          />
        )}
      </Drawer>

      <ConfirmDelete
        target={deleteTarget}
        pending={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
