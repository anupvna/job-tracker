import {
  TASK_LIMITS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  createTaskSchema,
  type CreateTask,
  type Task,
} from '@job-tracker/shared';
import { LoaderCircle, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { addDays, todayISO } from '../../lib/dates';
import { Button, IconButton } from '../ui/Button';
import { Field } from '../ui/Field';

interface Props {
  task: Task;
  onSave: (values: CreateTask) => Promise<unknown>;
  onCancel: () => void;
  onDelete: () => void;
}

type Errors = Partial<Record<'title' | 'notes' | 'dueDate' | 'tags', string>>;

const DATE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'Next week', days: 7 },
];

/** Edit a task in the side drawer. Validates with the same schema the API uses. */
export function TaskEditor({ task, onSave, onCancel, onDelete }: Props) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [priority, setPriority] = useState(task.priority);
  const [tagsText, setTagsText] = useState(task.tags.join(', '));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const today = todayISO();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const tags = tagsText
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, ''))
      .filter(Boolean);
    const result = createTaskSchema.safeParse({ title, notes, dueDate, priority, tags });
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof Errors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      await onSave(result.data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <h2 id="task-editor-title" className="text-base font-semibold">
          Edit task
        </h2>
        <IconButton aria-label="Close" onClick={onCancel}>
          <X className="size-4" />
        </IconButton>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <Field label="Task" htmlFor="task-title" error={errors.title} required>
          <input
            id="task-title"
            className="input"
            value={title}
            maxLength={TASK_LIMITS.title}
            aria-invalid={errors.title ? true : undefined}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Due date" htmlFor="task-due" error={errors.dueDate} hint="Leave empty for Someday.">
            <input
              id="task-due"
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDueDate(addDays(today, p.days))}
                  className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
                >
                  {p.label}
                </button>
              ))}
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate('')}
                  className="rounded-md px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100"
                >
                  Clear
                </button>
              )}
            </div>
          </Field>

          <Field label="Priority" htmlFor="task-priority">
            <select
              id="task-priority"
              className="input"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task['priority'])}
            >
              {[...TASK_PRIORITIES].reverse().map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Tags" htmlFor="task-tags" error={errors.tags} hint="Separate with commas, e.g. dsa, graphs">
          <input
            id="task-tags"
            className="input"
            value={tagsText}
            aria-invalid={errors.tags ? true : undefined}
            onChange={(e) => setTagsText(e.target.value)}
          />
        </Field>

        <Field label="Notes" htmlFor="task-notes" error={errors.notes}>
          <textarea
            id="task-notes"
            rows={5}
            className="input resize-y"
            value={notes}
            maxLength={TASK_LIMITS.notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-6 py-4">
        <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={onDelete}>
          <Trash2 className="size-4" aria-hidden />
          Delete
        </Button>
        <div className="flex gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}
