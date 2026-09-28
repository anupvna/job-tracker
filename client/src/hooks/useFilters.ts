import {
  APPLICATION_STATUSES,
  SORT_FIELDS,
  type ApplicationStatus,
  type SortField,
} from '@job-tracker/shared';
import { useCallback, useEffect, useState } from 'react';
import type { ApplicationFilters } from '../api/applications';

// Most urgent first: soonest follow-up at the top, apps without one at the bottom.
const DEFAULTS: ApplicationFilters = { sort: 'followUpDate', order: 'asc' };

function readFromUrl(): ApplicationFilters {
  const p = new URLSearchParams(window.location.search);
  const status = p.get('status');
  const sort = p.get('sort');
  return {
    status: APPLICATION_STATUSES.includes(status as ApplicationStatus)
      ? (status as ApplicationStatus)
      : undefined,
    q: p.get('q') ?? undefined,
    overdue: p.get('overdue') === 'true' || undefined,
    sort: SORT_FIELDS.includes(sort as SortField) ? (sort as SortField) : DEFAULTS.sort,
    order:
      p.get('order') === 'asc' || p.get('order') === 'desc'
        ? (p.get('order') as 'asc' | 'desc')
        : DEFAULTS.order,
  };
}

function writeToUrl(f: ApplicationFilters) {
  const p = new URLSearchParams();
  if (f.status) p.set('status', f.status);
  if (f.q) p.set('q', f.q);
  if (f.overdue) p.set('overdue', 'true');
  if (f.sort !== DEFAULTS.sort) p.set('sort', f.sort);
  if (f.order !== DEFAULTS.order) p.set('order', f.order);
  const qs = p.toString();
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
}

/** Filter state mirrored to the URL, so a filtered view can be bookmarked or shared. */
export function useFilters() {
  const [filters, setFilters] = useState<ApplicationFilters>(readFromUrl);

  useEffect(() => writeToUrl(filters), [filters]);

  const update = useCallback(
    (patch: Partial<ApplicationFilters>) => setFilters((f) => ({ ...f, ...patch })),
    [],
  );

  const toggleSort = useCallback((field: SortField) => {
    setFilters((f) =>
      f.sort === field
        ? { ...f, order: f.order === 'asc' ? 'desc' : 'asc' }
        : { ...f, sort: field, order: field === 'company' || field === 'role' ? 'asc' : 'desc' },
    );
  }, []);

  const reset = useCallback(() => setFilters(DEFAULTS), []);

  const isFiltered = Boolean(filters.status || filters.q || filters.overdue);

  return { filters, update, toggleSort, reset, isFiltered };
}
