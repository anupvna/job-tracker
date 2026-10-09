import { describe, expect, it } from 'vitest';
import { NEETCODE_150, NEETCODE_TOPICS } from './neetcode150.js';
import {
  buildSchedule,
  countStudyDays,
  nextStudyDay,
  studyPlanInputSchema,
  type ScheduleInput,
} from './studyPlan.js';

const WEEKDAYS = [1, 2, 3, 4, 5];
// 2026-10-12 is a Monday.
const MON = '2026-10-12';

function plan(over: Partial<ScheduleInput> = {}) {
  return buildSchedule({
    problems: NEETCODE_150,
    solved: new Map(),
    pace: 'low',
    studyDays: WEEKDAYS,
    startDate: MON,
    today: MON,
    ...over,
  });
}

const slugs = (n: number, from = 0) => NEETCODE_150.slice(from, from + n).map((p) => p.slug);

describe('NeetCode 150 catalog', () => {
  it('has 150 unique problems across 18 topics, starting with Arrays & Hashing', () => {
    expect(NEETCODE_150).toHaveLength(150);
    expect(new Set(NEETCODE_150.map((p) => p.slug)).size).toBe(150);
    expect(NEETCODE_TOPICS).toHaveLength(18);
    expect(NEETCODE_150[0]).toMatchObject({ slug: 'contains-duplicate', topic: 'Arrays & Hashing', difficulty: 'Easy' });
    for (const t of NEETCODE_TOPICS) expect(NEETCODE_150.some((p) => p.topic === t)).toBe(true);
  });

  it('keeps topics contiguous in roadmap order', () => {
    const order = NEETCODE_150.map((p) => NEETCODE_TOPICS.indexOf(p.topic));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe('calendar helpers', () => {
  it('counts study days inclusively', () => {
    expect(countStudyDays(MON, MON, WEEKDAYS)).toBe(1);
    expect(countStudyDays(MON, '2026-10-18', WEEKDAYS)).toBe(5); // Mon–Sun
    expect(countStudyDays(MON, '2026-10-25', WEEKDAYS)).toBe(10);
    expect(countStudyDays('2026-10-13', MON, WEEKDAYS)).toBe(0);
  });

  it('matches a brute-force count for every pattern over many ranges', () => {
    const patterns = [[0], [6], [1, 3, 5], [0, 1, 2, 3, 4, 5, 6], WEEKDAYS];
    for (const days of patterns) {
      for (let len = 0; len < 40; len++) {
        const to = new Date(Date.parse(`${MON}T00:00:00Z`) + len * 86_400_000).toISOString().slice(0, 10);
        let brute = 0;
        for (let i = 0; i <= len; i++) if (days.includes((1 + i) % 7)) brute++;
        expect(countStudyDays(MON, to, days)).toBe(brute);
      }
    }
  });

  it('finds the next study day', () => {
    expect(nextStudyDay('2026-10-17', WEEKDAYS)).toBe('2026-10-19'); // Sat → Mon
    expect(nextStudyDay(MON, WEEKDAYS)).toBe(MON);
  });
});

describe('buildSchedule', () => {
  it('lays out day 1 and the following study days in order', () => {
    const s = plan();
    expect(s.today).toEqual({
      dayNumber: 1,
      items: NEETCODE_150.slice(0, 2).map((problem) => ({ problem, solved: false })),
    });
    expect(s.upcoming[0]).toMatchObject({ date: '2026-10-13', dayNumber: 2 });
    expect(s.upcoming[0]!.problems.map((p) => p.slug)).toEqual(slugs(2, 2));
    // Friday is followed by Monday.
    expect(s.upcoming.map((d) => d.date)).toEqual([
      '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21',
    ]);
    expect(s.projectedFinish).toBe(s.plannedFinish);
    expect(s.delta).toBe(0);
  });

  it.each([
    ['low', [1, 2, 3, 4, 5], 75],
    ['medium', [1, 2, 3, 4, 5, 6], 50],
    ['high', [1, 2, 3, 4, 5, 6], 30],
  ] as const)('%s pace needs the right number of study days', (pace, days, n) => {
    const s = plan({ pace, studyDays: days });
    expect(countStudyDays(MON, s.projectedFinish!, days)).toBe(n);
  });

  it('keeps solved-today problems on today and fills the rest of the quota', () => {
    const solved = new Map([[NEETCODE_150[0]!.slug, MON]]);
    const s = plan({ solved });
    expect(s.today!.items.map((i) => [i.problem.slug, i.solved])).toEqual([
      [slugs(1)[0], true],
      [slugs(1, 1)[0], false],
    ]);
  });

  it('marks today complete without pulling extra work forward', () => {
    const solved = new Map(slugs(2).map((s) => [s, MON] as const));
    const s = plan({ solved });
    expect(s.today!.items.every((i) => i.solved)).toBe(true);
    expect(s.upcoming[0]!.problems.map((p) => p.slug)).toEqual(slugs(2, 2));
  });

  it('shifts work forward after missed days instead of piling it up', () => {
    // Started a week ago, nothing done: today is still just today's quota.
    const s = plan({ startDate: '2026-10-05', today: MON });
    expect(s.today!.dayNumber).toBe(6);
    expect(s.today!.items.map((i) => i.problem.slug)).toEqual(slugs(2));
    expect(s.delta).toBe(-10);
    expect(s.projectedFinish! > s.plannedFinish).toBe(true);
  });

  it('reports being ahead', () => {
    const solved = new Map(slugs(6).map((s) => [s, '2026-10-11'] as const));
    const ahead = plan({ startDate: '2026-10-11', today: MON, solved, studyDays: [0, 1, 2, 3, 4, 5, 6] });
    expect(ahead.delta).toBe(6 - 2); // 1 day before today × 2 per day
  });

  it('ignores work done before the plan started when measuring pace', () => {
    const earlier = new Map(slugs(30).map((s) => [s, '2026-09-01'] as const));
    const s = plan({ solved: earlier, startDate: '2026-10-09', today: MON });
    expect(s.delta).toBe(-2); // Fri was day 1 (2 due), nothing solved since
    expect(s.today!.items.map((i) => i.problem.slug)).toEqual(slugs(2, 30));
  });

  it('has no today block on rest days or before the start date', () => {
    expect(plan({ today: '2026-10-17' }).today).toBeNull(); // Saturday
    const future = plan({ startDate: '2026-10-19' });
    expect(future.started).toBe(false);
    expect(future.today).toBeNull();
    expect(future.upcoming[0]).toMatchObject({ date: '2026-10-19', dayNumber: 1 });
  });

  it('counts problems solved in any order and finishes when all are solved', () => {
    const almost = new Map(NEETCODE_150.slice(1).map((p) => [p.slug, '2026-10-01'] as const));
    const s = plan({ solved: almost });
    expect(s.today!.items.map((i) => i.problem.slug)).toEqual([NEETCODE_150[0]!.slug]);
    expect(s.projectedFinish).toBe(MON);
    const all = plan({ solved: new Map(NEETCODE_150.map((p) => [p.slug, '2026-10-01'] as const)) });
    expect(all.completed).toBe(true);
    expect(all.projectedFinish).toBeNull();
    expect(all.upcoming).toEqual([]);
  });
});

describe('studyPlanInputSchema', () => {
  it('normalizes study days and rejects empty ones', () => {
    expect(studyPlanInputSchema.parse({ pace: 'low', studyDays: [5, 1, 1], startDate: MON }).studyDays).toEqual([1, 5]);
    expect(studyPlanInputSchema.safeParse({ pace: 'low', studyDays: [], startDate: MON }).success).toBe(false);
    expect(studyPlanInputSchema.safeParse({ pace: 'turbo', studyDays: [1], startDate: MON }).success).toBe(false);
  });
});
