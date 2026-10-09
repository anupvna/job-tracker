import type { Task } from '@job-tracker/shared';
import { Check, CalendarDays, Flag, NotebookText, Trash2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { dueLabel, timeAgo } from '../../lib/dates';
import { IconButton } from '../ui/Button';
import { PRIORITY_STYLES } from './priority';

interface Props {
  task: Task;
  today: string;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  /** Hide the date chip when the list is already grouped by day. */
  hideDate?: boolean;
}

export function TaskRow({ task, today, onToggle, onEdit, onDelete, hideDate }: Props) {
  const done = task.doneAt !== null;
  const overdue = !done && task.dueDate !== null && task.dueDate < today;
  const p = PRIORITY_STYLES[task.priority];

  return (
    <li className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/80">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${done ? 'Reopen' : 'Complete'} “${task.title}”`}
        onClick={() => onToggle(task)}
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          done ? 'border-zinc-900 bg-zinc-900 text-white' : cn(p.ring, 'hover:bg-zinc-100'),
        )}
      >
        <Check
          className={cn('size-3', done ? 'opacity-100' : 'opacity-0 group-hover:opacity-40')}
          strokeWidth={3}
          aria-hidden
        />
      </button>

      <button
        type="button"
        onClick={() => onEdit(task)}
        className="min-w-0 flex-1 rounded text-left"
        aria-label={`Edit “${task.title}”`}
      >
        <span className={cn('block text-sm break-words', done ? 'text-zinc-400 line-through' : 'text-zinc-900')}>
          {task.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500 empty:hidden">
          {done && task.doneAt && <span>Completed {timeAgo(task.doneAt)}</span>}
          {!done && task.dueDate && !hideDate && (
            <span className={cn('inline-flex items-center gap-1', overdue && 'font-medium text-red-600')}>
              <CalendarDays className="size-3" aria-hidden />
              {dueLabel(task.dueDate, today)}
            </span>
          )}
          {task.priority !== 'none' && !done && (
            <span className={cn('inline-flex items-center gap-1', p.text)}>
              <Flag className="size-3" aria-hidden />
              {p.label}
            </span>
          )}
          {task.tags.map((t) => (
            <span key={t} className="rounded bg-zinc-100 px-1.5 py-px font-medium text-zinc-600">
              #{t}
            </span>
          ))}
          {task.notes && <NotebookText className="size-3" aria-label="Has notes" />}
        </span>
      </button>

      <IconButton
        aria-label={`Delete “${task.title}”`}
        onClick={() => onDelete(task)}
        className="size-7 shrink-0 text-zinc-400 hover:text-red-600 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </IconButton>
    </li>
  );
}
