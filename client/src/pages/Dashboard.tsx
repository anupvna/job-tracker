import {
  STATUS_LABELS,
  type Application,
  type ApplicationStatus,
  type CreateApplication,
  parsePostingUrl,
} from '@job-tracker/shared';
import { FileText, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ApplicationForm } from '../components/ApplicationForm';
import { ApplicationsTable } from '../components/ApplicationsTable';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { Header } from '../components/Header';
import { JobPostingPanel } from '../components/JobPostingPanel';
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
import { useBackfillSnapshots, usePostingStatus, useSaveSnapshot } from '../hooks/usePostings';
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
  const postings = usePostingStatus();
  const saveSnapshot = useSaveSnapshot();
  const backfill = useBackfillSnapshots();

  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);

  const openCreate = useCallback(() => setDrawer({ mode: 'create' }), []);
  useHotkey('n', openCreate);

  const today = todayISO();
  const rows = list.data ?? [];
  const trackerIsEmpty = stats.data?.total === 0 && !isFiltered;

  /** Save a copy of the posting in the background when the link is a supported job board. */
  function snapshotIfSupported(id: string, link: string | null, previousLink?: string | null) {
    if (!parsePostingUrl(link)) return;
    if (previousLink === link && postings.byApp.has(id)) return;
    saveSnapshot.mutate(id, {
      onSuccess: (s) =>
        s.postingStatus === 'closed'
          ? toast.warning('Heads up: that posting is no longer on the job board.')
          : toast.success('Saved a copy of the job description'),
      // A job board hiccup shouldn't bother the user; they can retry from the drawer.
      onError: () => undefined,
    });
  }

  async function handleSubmit(values: CreateApplication) {
    try {
      if (drawer?.mode === 'edit') {
        const updated = await updateMutation.mutateAsync({ id: drawer.app.id, patch: values });
        toast.success('Changes saved');
        snapshotIfSupported(updated.id, updated.link, drawer.app.link);
      } else {
        const created = await createMutation.mutateAsync(values);
        toast.success(`Added ${created.company}`);
        snapshotIfSupported(created.id, created.link);
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

  // Applications with a supported job-board link but no saved copy yet.
  const unsaved = postings.isSuccess
    ? rows.filter((a) => parsePostingUrl(a.link) && !postings.byApp.has(a.id)).length
    : 0;

  async function saveAllCopies() {
    let total = { saved: 0, closed: 0, failed: 0 };
    try {
      for (let round = 0; round < 10; round++) {
        const r = await backfill.mutateAsync();
        total = { saved: total.saved + r.saved, closed: total.closed + r.closed, failed: total.failed + r.failed };
        if (r.remaining === 0 || r.saved + r.closed === 0) break;
      }
      const parts = [`Saved ${total.saved} job description${total.saved === 1 ? '' : 's'}`];
      if (total.closed) parts.push(`${total.closed} already taken down`);
      if (total.failed) parts.push(`${total.failed} couldn’t be reached — try again later`);
      toast.success(parts.join(' · '));
    } catch (err) {
      toast.error(errorMessage(err));
    }
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
        postings={postings.byApp}
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

      {unsaved > 0 && !isFiltered && (
        <div className="flex flex-col gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 sm:flex-row sm:items-center">
          <FileText className="size-4 shrink-0 text-violet-600" aria-hidden />
          <p className="flex-1">
            <strong className="font-semibold">
              {unsaved} job posting{unsaved === 1 ? '' : 's'} not saved yet.
            </strong>{' '}
            Save a copy of each description before it’s taken down, and get notified when a posting closes.
          </p>
          <button
            type="button"
            onClick={saveAllCopies}
            disabled={backfill.isPending}
            className="inline-flex items-center gap-1.5 self-start font-semibold whitespace-nowrap underline-offset-2 hover:underline disabled:opacity-60 sm:self-auto"
          >
            {backfill.isPending && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
            Save copies →
          </button>
        </div>
      )}

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
            extra={
              drawer.mode === 'edit' ? (
                <JobPostingPanel applicationId={drawer.app.id} link={drawer.app.link} />
              ) : undefined
            }
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
