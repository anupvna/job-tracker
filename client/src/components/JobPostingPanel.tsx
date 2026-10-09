import { POSTING_LIMITS, POSTING_SOURCE_LABELS, parsePostingUrl, type JobSnapshot } from '@job-tracker/shared';
import { ArchiveX, CircleCheck, ClipboardPaste, FileText, LoaderCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSaveManualSnapshot, useSaveSnapshot, useSnapshot } from '../hooks/usePostings';
import { cn } from '../lib/cn';
import { formatDate, timeAgo, todayISO } from '../lib/dates';
import { Button } from './ui/Button';

/**
 * The saved copy of an application's job posting, and whether the posting is still up.
 * Lives inside the edit drawer.
 */
export function JobPostingPanel({ applicationId, link }: { applicationId: string; link: string | null }) {
  const snapshot = useSnapshot(applicationId);
  const save = useSaveSnapshot();
  const saveManual = useSaveManualSnapshot();
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const ref = parsePostingUrl(link);
  const snap = snapshot.data;

  function fetchCopy() {
    save.mutate(applicationId, {
      onSuccess: (s) =>
        s.postingStatus === 'closed'
          ? toast.warning('This posting is already gone from the job board.')
          : toast.success('Saved a copy of the job description'),
      onError: (err) => toast.error(err.message),
    });
  }

  function savePasted() {
    saveManual.mutate(
      { id: applicationId, description: text },
      {
        onSuccess: () => {
          toast.success('Job description saved');
          setPasting(false);
          setText('');
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <section aria-labelledby="posting-title" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="posting-title" className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Job posting
        </h3>
        {snap && <StatusPill snap={snap} />}
      </div>

      {snapshot.isPending ? (
        <div className="h-16 animate-pulse rounded-lg bg-zinc-100" />
      ) : snap && snap.description ? (
        <div className="rounded-lg border border-zinc-200">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500">
            <FileText className="size-3.5" aria-hidden />
            <span>
              Saved {formatDate(snap.fetchedAt.slice(0, 10), todayISO())}
              {snap.source !== 'manual' && ` from ${POSTING_SOURCE_LABELS[snap.source]}`}
            </span>
            {snap.title && <span className="font-medium text-zinc-700">· {snap.title}</span>}
            {snap.location && <span>· {snap.location}</span>}
          </div>
          <div
            className={cn(
              'px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-zinc-700',
              !expanded && 'max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]',
            )}
          >
            {snap.description}
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full border-t border-zinc-100 px-3 py-1.5 text-left text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            {expanded ? 'Show less' : 'Show full description'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          {snap?.postingStatus === 'closed'
            ? 'The posting was already gone when we tried to save it.'
            : 'Save a copy of the job description so you still have it at interview time, even if the posting is taken down.'}
        </p>
      )}

      {pasting ? (
        <div className="space-y-2">
          <label htmlFor="paste-description" className="sr-only">
            Job description
          </label>
          <textarea
            id="paste-description"
            rows={8}
            className="input resize-y"
            placeholder="Paste the full job description here…"
            value={text}
            maxLength={POSTING_LIMITS.description}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={savePasted} disabled={!text.trim() || saveManual.isPending}>
              {saveManual.isPending && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
              Save description
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPasting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {ref && (
            <Button size="sm" onClick={fetchCopy} disabled={save.isPending}>
              {save.isPending ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-3.5" aria-hidden />
              )}
              {snap && snap.source !== 'manual' ? 'Refresh copy' : `Save copy from ${POSTING_SOURCE_LABELS[ref.source]}`}
            </Button>
          )}
          <Button size="sm" variant={ref ? 'ghost' : 'secondary'} onClick={() => setPasting(true)}>
            <ClipboardPaste className="size-3.5" aria-hidden />
            {snap?.description ? 'Replace with pasted text' : 'Paste description'}
          </Button>
        </div>
      )}
      {!ref && !snap && (
        <p className="text-xs text-zinc-400">
          Greenhouse, Lever and Ashby links are saved and checked automatically. For other sites
          (LinkedIn, Workday…), paste the description.
        </p>
      )}
    </section>
  );
}

function StatusPill({ snap }: { snap: JobSnapshot }) {
  if (snap.postingStatus === 'closed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
        <ArchiveX className="size-3.5" aria-hidden />
        Posting closed{snap.closedAt ? ` · ${formatDate(snap.closedAt.slice(0, 10), todayISO())}` : ''}
      </span>
    );
  }
  if (snap.postingStatus === 'open') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
        <CircleCheck className="size-3.5" aria-hidden />
        Still open{snap.lastCheckedAt ? ` · checked ${timeAgo(snap.lastCheckedAt)}` : ''}
      </span>
    );
  }
  return null;
}
