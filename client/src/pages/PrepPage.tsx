import {
  TASK_VIEWS,
  type CreateTask,
  type Task,
  type TaskView,
} from '@job-tracker/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { StudyPlanCard } from '../components/plan/StudyPlanCard';
import { FollowUpsDue } from '../components/prep/FollowUpsDue';
import { QuickAdd } from '../components/prep/QuickAdd';
import { TaskEditor } from '../components/prep/TaskEditor';
import { TaskRow } from '../components/prep/TaskRow';
import { ErrorState } from '../components/States';
import { Drawer } from '../components/ui/Dialog';
import {
  useCreateTask,
  useDeleteTask,
  useTaskCounts,
  useTasks,
  useUpdateTask,
} from '../hooks/useTasks';
import { cn } from '../lib/cn';
import { dayHeading, todayISO } from '../lib/dates';

const VIEW_LABELS: Record<TaskView, string> = {
  today: 'Today',
  upcoming: 'Upcoming',
  someday: 'Someday',
  done: 'Done',
};

const EMPTY: Record<TaskView, { title: string; body: string }> = {
  today: { title: 'No tasks due today', body: 'Add something above, or plan ahead with a date like “fri”.' },
  upcoming: { title: 'Nothing scheduled yet', body: 'Give a task a date — “tmrw”, “mon”, “in 3 days”, “oct 20”.' },
  someday: { title: 'No someday ideas', body: 'Tasks without a date land here, so nothing gets lost.' },
  done: { title: 'Nothing completed yet', body: 'Tick a task off and it shows up here.' },
};

const longDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

function readView(): TaskView {
  const v = new URLSearchParams(window.location.search).get('view');
  return TASK_VIEWS.includes(v as TaskView) ? (v as TaskView) : 'today';
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong');

/** Where a newly created task will appear. */
function viewFor(task: Pick<Task, 'dueDate'>, today: string): TaskView {
  if (!task.dueDate) return 'someday';
  return task.dueDate <= today ? 'today' : 'upcoming';
}

export function PrepPage() {
  const [view, setView] = useState<TaskView>(readView);
  const [editing, setEditing] = useState<Task | null>(null);
  const today = todayISO();

  useEffect(() => {
    const qs = view === 'today' ? '' : `?view=${view}`;
    window.history.replaceState(null, '', `${window.location.pathname}${qs}`);
  }, [view]);

  const tasks = useTasks(view);
  const counts = useTaskCounts();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  async function add(input: CreateTask) {
    try {
      const created = await createTask.mutateAsync(input);
      const target = viewFor(created, today);
      toast.success(`Added to ${VIEW_LABELS[target]}`, {
        action: target !== view ? { label: 'Show', onClick: () => setView(target) } : undefined,
      });
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  }

  function toggle(task: Task) {
    const done = task.doneAt === null;
    updateTask.mutate(
      { id: task.id, patch: { done } },
      {
        onSuccess: () =>
          toast.success(done ? 'Task completed' : 'Task reopened', {
            action: {
              label: 'Undo',
              onClick: () => updateTask.mutate({ id: task.id, patch: { done: !done } }),
            },
          }),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  function remove(task: Task) {
    setEditing(null);
    deleteTask.mutate(task.id, {
      onSuccess: () =>
        toast.success('Task deleted', {
          action: {
            label: 'Undo',
            onClick: () =>
              createTask.mutate({
                title: task.title,
                notes: task.notes,
                dueDate: task.dueDate,
                priority: task.priority,
                tags: task.tags,
              }),
          },
        }),
      onError: (err) => toast.error(errorMessage(err)),
    });
  }

  async function save(values: CreateTask) {
    if (!editing) return;
    try {
      await updateTask.mutateAsync({ id: editing.id, patch: values });
      toast.success('Changes saved');
      setEditing(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const rows = tasks.data ?? [];
  const rowProps = { today, onToggle: toggle, onEdit: setEditing, onDelete: remove };

  let list: ReactNode;
  if (tasks.isPending) list = <ListSkeleton />;
  else if (tasks.isError) list = <ErrorState message={errorMessage(tasks.error)} onRetry={() => tasks.refetch()} />;
  else if (view === 'today') {
    const overdue = rows.filter((t) => t.dueDate! < today);
    const dueToday = rows.filter((t) => t.dueDate === today);
    list = (
      <>
        {overdue.length > 0 && (
          <Group title={`Overdue · ${overdue.length}`} tone="danger">
            {overdue.map((t) => <TaskRow key={t.id} task={t} {...rowProps} />)}
          </Group>
        )}
        {dueToday.length > 0 && (
          <Group title={`Today · ${dueToday.length}`}>
            {dueToday.map((t) => <TaskRow key={t.id} task={t} {...rowProps} hideDate />)}
          </Group>
        )}
        {rows.length === 0 && <Empty view={view} />}
        <FollowUpsDue today={today} />
      </>
    );
  } else if (rows.length === 0) list = <Empty view={view} />;
  else if (view === 'upcoming') {
    const byDay = new Map<string, Task[]>();
    for (const t of rows) byDay.set(t.dueDate!, [...(byDay.get(t.dueDate!) ?? []), t]);
    list = [...byDay].map(([day, items]) => (
      <Group key={day} title={dayHeading(day, today)}>
        {items.map((t) => <TaskRow key={t.id} task={t} {...rowProps} hideDate />)}
      </Group>
    ));
  } else {
    list = (
      <ul className="divide-y divide-zinc-100">
        {rows.map((t) => <TaskRow key={t.id} task={t} {...rowProps} />)}
      </ul>
    );
  }

  const c = counts.data;
  const badge: Record<TaskView, number | undefined> = {
    today: c?.today,
    upcoming: c?.upcoming,
    someday: c?.someday,
    done: undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prep</h1>
          <p className="text-sm text-zinc-500">Plan your interview prep and keep it on track.</p>
        </div>
        <p className="text-sm font-medium text-zinc-600">{longDate.format(new Date())}</p>
      </div>

      <StudyPlanCard />

      <main className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
        <div className="border-b border-zinc-100 px-4 pt-4 pb-2">
          <QuickAdd onAdd={add} />
        </div>

        <div role="tablist" aria-label="Task lists" className="flex border-b border-zinc-100 px-1 sm:gap-1 sm:px-3">
          {TASK_VIEWS.map((v) => {
            const active = v === view;
            const n = badge[v];
            return (
              <button
                key={v}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setView(v)}
                className={cn(
                  'relative flex h-11 flex-1 items-center justify-center gap-1.5 px-1.5 text-sm font-medium transition-colors sm:flex-none sm:px-2.5',
                  'after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full',
                  active ? 'text-zinc-900 after:bg-zinc-900' : 'text-zinc-500 hover:text-zinc-900',
                )}
              >
                {VIEW_LABELS[v]}
                {n !== undefined && n > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[11px] leading-5 tabular-nums',
                      v === 'today' && c && c.overdue > 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-zinc-100 text-zinc-600',
                    )}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          aria-label={VIEW_LABELS[view]}
          className={tasks.isFetching && !tasks.isPending ? 'opacity-70 transition-opacity' : undefined}
        >
          {list}
        </div>
      </main>


      <Drawer open={editing !== null} onClose={() => setEditing(null)} labelledBy="task-editor-title">
        {editing && (
          <TaskEditor
            key={editing.id}
            task={editing}
            onSave={save}
            onCancel={() => setEditing(null)}
            onDelete={() => remove(editing)}
          />
        )}
      </Drawer>
    </div>
  );
}

function Group({ title, tone, children }: { title: string; tone?: 'danger'; children: ReactNode }) {
  return (
    <section>
      <h3
        className={cn(
          'border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-xs font-semibold tracking-wide uppercase',
          tone === 'danger' ? 'text-red-600' : 'text-zinc-500',
        )}
      >
        {title}
      </h3>
      <ul className="divide-y divide-zinc-100">{children}</ul>
    </section>
  );
}

function Empty({ view }: { view: TaskView }) {
  const e = EMPTY[view];
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-medium text-zinc-900">{e.title}</p>
      <p className="mt-1 text-sm text-zinc-500">{e.body}</p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-zinc-100" aria-busy="true" aria-label="Loading tasks">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="size-5 animate-pulse rounded-full bg-zinc-200" />
          <div className="h-3.5 animate-pulse rounded bg-zinc-200" style={{ width: `${40 + i * 12}%` }} />
        </div>
      ))}
    </div>
  );
}
