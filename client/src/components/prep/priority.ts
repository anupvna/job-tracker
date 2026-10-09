import type { TaskPriority } from '@job-tracker/shared';

/** Checkbox ring + flag colour per priority (Todoist-style: the circle shows urgency). */
export const PRIORITY_STYLES: Record<TaskPriority, { ring: string; text: string; label: string }> = {
  high: { ring: 'border-red-500 bg-red-50', text: 'text-red-600', label: 'High' },
  medium: { ring: 'border-amber-500 bg-amber-50', text: 'text-amber-600', label: 'Medium' },
  low: { ring: 'border-sky-500 bg-sky-50', text: 'text-sky-600', label: 'Low' },
  none: { ring: 'border-zinc-300 bg-white', text: 'text-zinc-400', label: 'None' },
};
