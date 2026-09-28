import { TriangleAlert, Briefcase, Plus, SearchX, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';

export function EmptyState({
  onAdd,
  onLoadSample,
  loadingSample,
}: {
  onAdd: () => void;
  onLoadSample: () => void;
  loadingSample: boolean;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
        <Briefcase className="size-6 text-zinc-500" aria-hidden />
      </div>
      <h2 className="mt-4 text-base font-semibold">No applications yet</h2>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        Add the roles you’re targeting, track referrals, and set follow-up dates so nothing slips.
      </p>
      <div className="mt-6 flex gap-2">
        <Button variant="primary" onClick={onAdd}>
          <Plus className="size-4" aria-hidden />
          Add application
        </Button>
        <Button onClick={onLoadSample} disabled={loadingSample}>
          <Sparkles className="size-4" aria-hidden />
          {loadingSample ? 'Loading…' : 'Load sample data'}
        </Button>
      </div>
    </div>
  );
}

export function NoResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <SearchX className="size-8 text-zinc-400" aria-hidden />
      <h2 className="mt-3 text-sm font-semibold">No matching applications</h2>
      <p className="mt-1 text-sm text-zinc-500">Try a different search or status.</p>
      <Button size="sm" className="mt-4" onClick={onReset}>
        Clear filters
      </Button>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-16 text-center">
      <TriangleAlert className="size-8 text-amber-500" aria-hidden />
      <h2 className="mt-3 text-sm font-semibold">Couldn’t load applications</h2>
      <p className="mt-1 text-sm text-zinc-500">{message}</p>
      <Button size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="divide-y divide-zinc-100" aria-busy="true" aria-label="Loading applications">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 px-4 py-4">
          <div className="w-1/4 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-200" />
            <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-100" />
          <div className="h-3.5 w-24 animate-pulse rounded bg-zinc-100" />
          <div className="h-3.5 w-16 animate-pulse rounded bg-zinc-100" />
          <div className="h-3.5 w-20 animate-pulse rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}
