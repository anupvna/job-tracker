import { TAG_PATTERN, TASK_LIMITS, type TaskPriority } from './tasks.js';

/*
 * Quick-add parser: turns "LC 2 mediums tomorrow #dsa !high" into
 * { title: "LC 2 mediums", dueDate: <tomorrow>, tags: ["dsa"], priority: "high" }.
 *
 * Pure and deterministic — `today` is passed in, so it is trivially testable and the
 * client can preview exactly what will be saved before the user presses Enter.
 */

export interface ParsedQuickAdd {
  title: string;
  dueDate: string | null;
  priority: TaskPriority;
  tags: string[];
}

// ---------- date helpers (ISO calendar strings, computed in UTC so no DST surprises) ----------

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

function isValidISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = toDate(iso);
  // Rejects month 13 (Invalid Date) and rollovers like Feb 30 → Mar 2.
  return !Number.isNaN(d.getTime()) && toISO(d) === iso;
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

/** The given weekday on or after `today` (so "fri" typed on a Friday means today). */
function upcomingWeekday(today: string, weekday: number): string {
  const diff = (weekday - toDate(today).getUTCDay() + 7) % 7;
  return addDaysISO(today, diff);
}

/** Month/day in the current year, or next year if that date has already passed. */
function monthDay(today: string, month: number, day: number): string | null {
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    const iso = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (isValidISO(iso) && iso >= today) return iso;
  }
  return null;
}

// ---------- token rules ----------

// A token ends at whitespace, or at punctuation that is itself followed by whitespace
// (so "fri." matches but "Monday.com" doesn't).
const END = String.raw`(?=$|\s|[,.;!?](?:\s|$))`;
// Leading whitespace is consumed (not a lookbehind, which older iOS Safari lacks).
const START = String.raw`(?:^|\s)`;
const WEEKDAY_RE = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const PREFIX = String.raw`(?:(?:on|by|due)\s+)?`;

type DateRule = { re: RegExp; resolve: (m: RegExpMatchArray, today: string) => string | null };

const DATE_RULES: DateRule[] = [
  {
    re: new RegExp(`${START}${PREFIX}(\\d{4}-\\d{2}-\\d{2})${END}`, 'i'),
    resolve: (m) => (isValidISO(m[1]!) ? m[1]! : null),
  },
  {
    re: new RegExp(`${START}${PREFIX}(today|tonight)${END}`, 'i'),
    resolve: (_m, today) => today,
  },
  {
    re: new RegExp(`${START}${PREFIX}(tomorrow|tmrw|tmr)${END}`, 'i'),
    resolve: (_m, today) => addDaysISO(today, 1),
  },
  {
    re: new RegExp(`${START}in\\s+(\\d{1,3})\\s*(days?|d|weeks?|wks?|w)${END}`, 'i'),
    resolve: (m, today) => {
      const n = Number(m[1]);
      return addDaysISO(today, /^w/i.test(m[2]!) ? n * 7 : n);
    },
  },
  {
    re: new RegExp(`${START}next\\s+week${END}`, 'i'),
    // The Monday after today.
    resolve: (_m, today) => upcomingWeekday(addDaysISO(today, 1), 1),
  },
  {
    re: new RegExp(`${START}(?:this\\s+)?weekend${END}`, 'i'),
    resolve: (_m, today) => upcomingWeekday(today, 6),
  },
  {
    // "next fri" = the Friday after the coming one.
    re: new RegExp(`${START}${PREFIX}(next\\s+)?(${WEEKDAY_RE})${END}`, 'i'),
    resolve: (m, today) => {
      const date = upcomingWeekday(today, WEEKDAYS[m[2]!.toLowerCase()]!);
      return m[1] ? addDaysISO(date, 7) : date;
    },
  },
  {
    // "oct 12", "October 12th"
    re: new RegExp(`${START}${PREFIX}(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?${END}`, 'i'),
    resolve: (m, today) => monthDay(today, MONTHS[m[1]!.toLowerCase()]!, Number(m[2])),
  },
  {
    // "12 oct", "12th October"
    re: new RegExp(`${START}${PREFIX}(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})${END}`, 'i'),
    resolve: (m, today) => monthDay(today, MONTHS[m[2]!.toLowerCase()]!, Number(m[1])),
  },
];

const PRIORITY_RE = new RegExp(`${START}!(high|hi|h|p1|medium|med|m|p2|low|lo|l|p3)${END}`, 'gi');
const PRIORITY_MAP: Record<string, TaskPriority> = {
  high: 'high', hi: 'high', h: 'high', p1: 'high',
  medium: 'medium', med: 'medium', m: 'medium', p2: 'medium',
  low: 'low', lo: 'low', l: 'low', p3: 'low',
};

const TAG_RE = new RegExp(`${START}#([a-z0-9][a-z0-9_-]*)${END}`, 'gi');

/** Parse quick-add text. Anything not recognised stays in the title. */
export function parseQuickAdd(input: string, today: string): ParsedQuickAdd {
  let text = ` ${input} `;
  const tags: string[] = [];
  let priority: TaskPriority = 'none';
  let dueDate: string | null = null;

  text = text.replace(TAG_RE, (match, tag: string) => {
    const t = tag.toLowerCase();
    if (t.length > TASK_LIMITS.tag || !TAG_PATTERN.test(t)) return match;
    if (!tags.includes(t) && tags.length < TASK_LIMITS.tags) tags.push(t);
    return ' ';
  });

  text = text.replace(PRIORITY_RE, (_match, p: string) => {
    priority = PRIORITY_MAP[p.toLowerCase()]!;
    return ' ';
  });

  // First matching date phrase wins; others stay in the title.
  for (const rule of DATE_RULES) {
    const m = text.match(rule.re);
    if (!m) continue;
    const resolved = rule.resolve(m, today);
    if (!resolved) continue;
    dueDate = resolved;
    text = text.slice(0, m.index) + ' ' + text.slice(m.index! + m[0].length);
    break;
  }

  const title = text.replace(/\s+/g, ' ').trim();
  // A bare "tomorrow" or "#dsa" is a title, not metadata.
  if (!title) return { title: input.trim(), dueDate: null, priority: 'none', tags: [] };
  return { title, dueDate, priority, tags };
}
