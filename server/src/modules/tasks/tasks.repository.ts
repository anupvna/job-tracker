import type {
  CreateTask,
  ListTasksQuery,
  Task,
  TaskCounts,
  TaskPriority,
  UpdateTask,
} from '@job-tracker/shared';
import type { Db } from '../../db/pool.js';

interface TaskRow {
  id: string;
  title: string;
  notes: string;
  due_date: string | null;
  priority: TaskPriority;
  tags: string[];
  done_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** API field → column; also the whitelist of writable fields (never interpolate input). */
const COLUMNS = {
  title: 'title',
  notes: 'notes',
  dueDate: 'due_date',
  priority: 'priority',
  tags: 'tags',
} as const satisfies Record<keyof CreateTask, string>;

type WritableField = keyof typeof COLUMNS;

// High first. Constant SQL, no user input.
const PRIORITY_ORDER = `array_position(ARRAY['high','medium','low','none']::text[], priority)`;

/** Row limit per list, so a runaway account can't produce a huge response. */
const LIST_LIMIT = 500;

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.due_date,
    priority: row.priority,
    tags: row.tags,
    doneAt: row.done_at ? row.done_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Each view is a fixed WHERE + ORDER BY; `$2` is always the caller's "today". */
const VIEWS = {
  today: {
    where: 'done_at IS NULL AND due_date <= $2::date',
    order: `due_date ASC, ${PRIORITY_ORDER}, created_at`,
  },
  upcoming: {
    where: 'done_at IS NULL AND due_date > $2::date',
    order: `due_date ASC, ${PRIORITY_ORDER}, created_at`,
  },
  someday: {
    // $2 unused here but keeps parameter numbering identical across views.
    where: 'done_at IS NULL AND due_date IS NULL AND $2::date IS NOT NULL',
    order: `${PRIORITY_ORDER}, created_at DESC`,
  },
  done: {
    where: 'done_at IS NOT NULL AND $2::date IS NOT NULL',
    order: 'done_at DESC',
  },
} as const;

/** Data access for planner tasks. Every query is scoped by user_id. */
export class TasksRepository {
  constructor(private readonly db: Db) {}

  async list(userId: string, { view, today }: ListTasksQuery): Promise<Task[]> {
    const { where, order } = VIEWS[view];
    const { rows } = await this.db.query<TaskRow>(
      `SELECT * FROM tasks WHERE user_id = $1 AND ${where} ORDER BY ${order} LIMIT ${LIST_LIMIT}`,
      [userId, today],
    );
    return rows.map(toTask);
  }

  async counts(userId: string, today: string): Promise<TaskCounts> {
    const { rows } = await this.db.query<Record<keyof TaskCounts, string>>(
      `SELECT count(*) FILTER (WHERE due_date <= $2::date) AS today,
              count(*) FILTER (WHERE due_date <  $2::date) AS overdue,
              count(*) FILTER (WHERE due_date >  $2::date) AS upcoming,
              count(*) FILTER (WHERE due_date IS NULL)     AS someday
         FROM tasks
        WHERE user_id = $1 AND done_at IS NULL`,
      [userId, today],
    );
    const r = rows[0]!;
    return {
      today: Number(r.today),
      overdue: Number(r.overdue),
      upcoming: Number(r.upcoming),
      someday: Number(r.someday),
    };
  }

  async countAll(userId: string): Promise<number> {
    const { rows } = await this.db.query<{ n: string }>(
      'SELECT count(*) AS n FROM tasks WHERE user_id = $1',
      [userId],
    );
    return Number(rows[0]!.n);
  }

  async findById(userId: string, id: string): Promise<Task | null> {
    const { rows } = await this.db.query<TaskRow>(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return rows[0] ? toTask(rows[0]) : null;
  }

  async create(userId: string, input: CreateTask): Promise<Task> {
    const fields = Object.keys(COLUMNS) as WritableField[];
    const { rows } = await this.db.query<TaskRow>(
      `INSERT INTO tasks (user_id, ${fields.map((f) => COLUMNS[f]).join(', ')})
       VALUES ($1, ${fields.map((_, i) => `$${i + 2}`).join(', ')})
       RETURNING *`,
      [userId, ...fields.map((f) => input[f])],
    );
    return toTask(rows[0]!);
  }

  async update(userId: string, id: string, patch: UpdateTask): Promise<Task | null> {
    const params: unknown[] = [id, userId];
    const assignments: string[] = [];
    for (const f of Object.keys(COLUMNS) as WritableField[]) {
      if (patch[f] === undefined) continue;
      params.push(patch[f]);
      assignments.push(`${COLUMNS[f]} = $${params.length}`);
    }
    if (patch.done !== undefined) {
      // Keep the original completion time if it's already done.
      params.push(patch.done);
      assignments.push(
        `done_at = CASE WHEN $${params.length}::boolean THEN COALESCE(done_at, now()) ELSE NULL END`,
      );
    }
    if (assignments.length === 0) return this.findById(userId, id);

    const { rows } = await this.db.query<TaskRow>(
      `UPDATE tasks SET ${assignments.join(', ')}
        WHERE id = $1 AND user_id = $2
        RETURNING *`,
      params,
    );
    return rows[0] ? toTask(rows[0]) : null;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { rowCount } = await this.db.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [
      id,
      userId,
    ]);
    return (rowCount ?? 0) > 0;
  }
}
