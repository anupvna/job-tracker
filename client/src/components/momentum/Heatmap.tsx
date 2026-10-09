import type { ActivityDay } from '@job-tracker/shared';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { cn } from '../../lib/cn';
import { addDays } from '../../lib/dates';

/** Sequential single-hue ramp (light → dark) for "how much happened that day". */
const LEVELS = ['bg-zinc-100', 'bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600', 'bg-emerald-800'];
const LEVEL_LABELS = ['No activity', '1–2', '3–4', '5–7', '8+'];

function level(n: number) {
  if (n === 0) return 0;
  if (n <= 2) return 1;
  if (n <= 4) return 2;
  if (n <= 7) return 3;
  return 4;
}

const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short' });
const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * GitHub-style contribution grid: one column per week (Mon–Sun), one cell per day.
 * Hover (or long-press) a cell for the exact counts.
 */
export function Heatmap({ days, from, today }: { days: ActivityDay[]; from: string; today: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);

  const weeks = useMemo(() => {
    const cols: string[][] = [];
    for (let start = from; start <= today; start = addDays(start, 7)) {
      cols.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
    }
    return cols;
  }, [from, today]);

  const totals = useMemo(() => {
    let solves = 0;
    let reviews = 0;
    for (const d of days) {
      solves += d.solves;
      reviews += d.reviews;
    }
    return { solves, reviews, active: days.length };
  }, [days]);

  // Start scrolled to the most recent weeks on narrow screens.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks.length]);

  return (
    <figure className="space-y-2">
      <div ref={scroller} className="overflow-x-auto pb-1">
        <div
          role="img"
          aria-label={`Activity over the last ${weeks.length} weeks: ${totals.solves} problems solved and ${totals.reviews} revisions across ${totals.active} active days.`}
          className="inline-grid grid-flow-col gap-[3px] [grid-auto-columns:11px] [grid-template-rows:auto_repeat(7,11px)] md:[grid-auto-columns:14px] md:[grid-template-rows:auto_repeat(7,14px)]"
        >
          {weeks.map((week, w) => {
            const firstOfMonth = week.find((d) => d.endsWith('-01'));
            // Skip the very first column so a partial month label never gets clipped.
            const label = w === 0 ? undefined : firstOfMonth;
            return [
              <div key={`m${w}`} aria-hidden className="h-4 overflow-visible text-[10px] leading-4 whitespace-nowrap text-zinc-500">
                {label ? monthFmt.format(new Date(`${label}T00:00:00`)) : ''}
              </div>,
              ...week.map((day) => {
                if (day > today) return <div key={day} aria-hidden />;
                const a = byDay.get(day);
                const n = (a?.solves ?? 0) + (a?.reviews ?? 0);
                const tip = `${dayFmt.format(new Date(`${day}T00:00:00`))}: ${
                  n === 0 ? 'no activity' : `${a!.solves} solved, ${a!.reviews} revised`
                }`;
                return (
                  <div
                    key={day}
                    title={tip}
                    aria-hidden
                    className={cn(
                      'rounded-[2px]',
                      LEVELS[level(n)],
                      day === today && 'ring-1 ring-zinc-900 ring-offset-1',
                    )}
                  />
                );
              }),
            ];
          })}
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>
          {totals.solves} solved · {totals.reviews} revised · {totals.active} active days
        </span>
        <span className="flex items-center gap-1" aria-label="Legend: lighter is less activity, darker is more">
          Less
          {LEVELS.map((c, i) => (
            <span key={c} title={LEVEL_LABELS[i]} className={cn('inline-block size-[11px] rounded-[2px]', c)} />
          ))}
          More
        </span>
      </figcaption>
    </figure>
  );
}
