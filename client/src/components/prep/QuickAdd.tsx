import { createTaskSchema, parseQuickAdd, type CreateTask } from '@job-tracker/shared';
import { CalendarDays, CornerDownLeft, Flag, Hash, LoaderCircle, Plus } from 'lucide-react';
import { useCallback, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useHotkey } from '../../hooks/useHotkey';
import { cn } from '../../lib/cn';
import { dueLabel, todayISO } from '../../lib/dates';
import { PRIORITY_STYLES } from './priority';

interface Props {
  onAdd: (task: CreateTask) => Promise<unknown>;
}

/**
 * One-line task entry with natural-language parsing. The preview chips under the input
 * show exactly what will be saved, so the parser never surprises anyone.
 */
export function QuickAdd({ onAdd }: Props) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const today = todayISO();

  const focus = useCallback(() => inputRef.current?.focus(), []);
  useHotkey('n', focus);

  const parsed = text.trim() ? parseQuickAdd(text, today) : null;
  const hasMeta = Boolean(
    parsed && (parsed.dueDate || parsed.priority !== 'none' || parsed.tags.length),
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed || pending) return;
    const result = createTaskSchema.safeParse(parsed);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Check the task');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onAdd(result.data);
      setText('');
    } catch {
      // The caller shows a toast; keep the text so nothing is lost.
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="relative">
        <Plus className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          aria-label="Add a task"
          aria-describedby="quick-add-hint"
          aria-invalid={error ? true : undefined}
          placeholder="Add a task…"
          maxLength={400}
          autoComplete="off"
          enterKeyHint="done"
          className="input h-11 pr-24 pl-9 text-[15px]"
        />
        <button
          type="submit"
          disabled={!parsed || pending}
          className="absolute top-1/2 right-1.5 inline-flex h-8 -translate-y-1/2 items-center gap-1.5 rounded-md bg-zinc-900 px-2.5 text-[13px] font-medium text-white transition-colors hover:bg-zinc-800 disabled:bg-zinc-300"
        >
          {pending ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <CornerDownLeft className="size-3.5" aria-hidden />
          )}
          Add
        </button>
      </div>

      <div id="quick-add-hint" className="flex min-h-6 flex-wrap items-center gap-1.5 text-xs" aria-live="polite">
        {error ? (
          <span className="text-red-600">{error}</span>
        ) : hasMeta && parsed ? (
          <>
            <span className="text-zinc-500">Saving as</span>
            <span className="font-medium text-zinc-800">“{parsed.title}”</span>
            {parsed.dueDate && (
              <Chip>
                <CalendarDays className="size-3" aria-hidden />
                {dueLabel(parsed.dueDate, today)}
              </Chip>
            )}
            {parsed.priority !== 'none' && (
              <Chip className={PRIORITY_STYLES[parsed.priority].text}>
                <Flag className="size-3" aria-hidden />
                {PRIORITY_STYLES[parsed.priority].label}
              </Chip>
            )}
            {parsed.tags.map((t) => (
              <Chip key={t}>
                <Hash className="size-3" aria-hidden />
                {t}
              </Chip>
            ))}
          </>
        ) : (
          <span className="text-zinc-400">
            Try <span className="font-medium text-zinc-500">LC 2 mediums tmrw #dsa !high</span>
            <span className="hidden sm:inline">
              {' '}· dates like fri, in 3 days, oct 20 · priority !high !med !low · press{' '}
              <kbd className="kbd">N</kbd> to focus
            </span>
          </span>
        )}
      </div>
    </form>
  );
}

function Chip({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700',
        className,
      )}
    >
      {children}
    </span>
  );
}
