import { z } from 'zod';

/*
 * Prep planner tasks. Same contract on both sides: the server validates requests with these
 * schemas and the client validates its forms (and quick-add output) with them.
 */

export const TASK_PRIORITIES = ['none', 'low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: 'No priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/** Which list to load. today = overdue + due today; someday = no date; done = recently completed. */
export const TASK_VIEWS = ['today', 'upcoming', 'someday', 'done'] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export const TASK_LIMITS = {
  title: 200,
  notes: 2000,
  tag: 30,
  tags: 10,
  /** Hard cap per account so one user can't fill the database. */
  perUser: 5000,
} as const;

export const TAG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(TASK_LIMITS.tag, `Tags must be ${TASK_LIMITS.tag} characters or fewer`)
  .regex(TAG_PATTERN, 'Tags use letters, numbers, - and _');

const tagsSchema = z
  .array(tagSchema)
  .max(TASK_LIMITS.tags, `Use at most ${TASK_LIMITS.tags} tags`)
  .transform((tags) => [...new Set(tags)]);

/** Calendar date (YYYY-MM-DD) or null. Empty strings from form inputs become null. */
const optionalDate = z
  .union([z.iso.date({ message: 'Use a valid date (YYYY-MM-DD)' }), z.literal(''), z.null()])
  .transform((v) => (v ? v : null));

const taskFields = {
  title: z
    .string()
    .trim()
    .min(1, 'Task is required')
    .max(TASK_LIMITS.title, `Must be ${TASK_LIMITS.title} characters or fewer`),
  notes: z.string().trim().max(TASK_LIMITS.notes, `Must be ${TASK_LIMITS.notes} characters or fewer`),
  dueDate: optionalDate,
  priority: z.enum(TASK_PRIORITIES),
  tags: tagsSchema,
};

/** POST /api/tasks */
export const createTaskSchema = z.object({
  title: taskFields.title,
  notes: taskFields.notes.default(''),
  dueDate: taskFields.dueDate.default(null),
  priority: taskFields.priority.default('none'),
  tags: taskFields.tags.default([]),
});

/** PATCH /api/tasks/:id — any field, plus `done` to complete / reopen. */
export const updateTaskSchema = z
  .object({ ...taskFields, done: z.boolean() })
  .partial()
  .refine((patch) => Object.values(patch).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });

/** GET /api/tasks */
export const listTasksQuerySchema = z.object({
  view: z.enum(TASK_VIEWS).default('today'),
  today: z.iso.date({ message: 'today must be YYYY-MM-DD' }),
});

/** GET /api/tasks/counts */
export const taskCountsQuerySchema = z.object({
  today: z.iso.date({ message: 'today must be YYYY-MM-DD' }),
});

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type CreateTask = z.output<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type UpdateTask = z.output<typeof updateTaskSchema>;
export type ListTasksQuery = z.output<typeof listTasksQuerySchema>;

export interface Task {
  id: string;
  title: string;
  notes: string;
  dueDate: string | null;
  priority: TaskPriority;
  tags: string[];
  /** ISO timestamp when completed; null while open. */
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCounts {
  /** Open tasks due today or earlier (includes overdue). */
  today: number;
  overdue: number;
  upcoming: number;
  someday: number;
}
