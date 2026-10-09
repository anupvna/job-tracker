import { describe, expect, it } from 'vitest';
import { addDaysISO, parseQuickAdd } from './quickAdd.js';
import { createTaskSchema, updateTaskSchema } from './tasks.js';

// 2026-10-09 is a Friday.
const TODAY = '2026-10-09';
const p = (s: string) => parseQuickAdd(s, TODAY);

describe('parseQuickAdd', () => {
  it('parses the headline example', () => {
    expect(p('LC 2 mediums tomorrow #dsa !high')).toEqual({
      title: 'LC 2 mediums',
      dueDate: '2026-10-10',
      priority: 'high',
      tags: ['dsa'],
    });
  });

  it('leaves plain text alone', () => {
    expect(p('Update resume')).toEqual({ title: 'Update resume', dueDate: null, priority: 'none', tags: [] });
  });

  it.each([
    ['today', '2026-10-09'],
    ['tonight', '2026-10-09'],
    ['tmrw', '2026-10-10'],
    ['in 3 days', '2026-10-12'],
    ['in 2 weeks', '2026-10-23'],
    ['in 1w', '2026-10-16'],
    ['fri', '2026-10-09'], // same weekday = today
    ['mon', '2026-10-12'],
    ['on wednesday', '2026-10-14'],
    ['next fri', '2026-10-16'],
    ['next week', '2026-10-12'],
    ['weekend', '2026-10-10'],
    ['oct 20', '2026-10-20'],
    ['by October 20th', '2026-10-20'],
    ['20 oct', '2026-10-20'],
    ['jan 5', '2027-01-05'], // already passed this year → next year
    ['2026-12-01', '2026-12-01'],
  ])('"%s" → %s', (phrase, date) => {
    expect(p(`Mock interview ${phrase}`)).toMatchObject({ title: 'Mock interview', dueDate: date });
  });

  it('ignores impossible dates and keeps them in the title', () => {
    expect(p('Thing feb 30')).toMatchObject({ title: 'Thing feb 30', dueDate: null });
    expect(p('Thing 2026-13-01')).toMatchObject({ title: 'Thing 2026-13-01', dueDate: null });
    expect(p('Thing oct 0')).toMatchObject({ title: 'Thing oct 0', dueDate: null });
    expect(p('Thing 99 oct')).toMatchObject({ title: 'Thing 99 oct', dueDate: null });
  });

  it('does not match words inside other words', () => {
    expect(p('Monday.com research')).toMatchObject({ dueDate: null });
    expect(p('Review the friday-deploy notes')).toMatchObject({ dueDate: null });
    expect(p('Read email#2')).toMatchObject({ title: 'Read email#2', tags: [] });
    expect(p('Fix bug!')).toMatchObject({ title: 'Fix bug!', priority: 'none' });
  });

  it('uses the first date phrase only', () => {
    expect(p('Move fri meeting to mon')).toMatchObject({
      title: 'Move meeting to mon',
      dueDate: '2026-10-09',
    });
  });

  it('collects several tags, lowercased and de-duplicated', () => {
    expect(p('Graphs #DSA #graphs #dsa')).toMatchObject({ title: 'Graphs', tags: ['dsa', 'graphs'] });
  });

  it.each([
    ['!high', 'high'],
    ['!p1', 'high'],
    ['!med', 'medium'],
    ['!m', 'medium'],
    ['!low', 'low'],
    ['!p3', 'low'],
  ])('priority %s → %s', (token, priority) => {
    expect(p(`Task ${token}`)).toMatchObject({ title: 'Task', priority });
  });

  it('keeps metadata-only input as the title', () => {
    expect(p('tomorrow')).toEqual({ title: 'tomorrow', dueDate: null, priority: 'none', tags: [] });
    expect(p('#dsa')).toEqual({ title: '#dsa', dueDate: null, priority: 'none', tags: [] });
  });

  it('produces input the API schema accepts', () => {
    const parsed = p('System design: read chapter 1 in 2 days #system-design !med');
    expect(createTaskSchema.parse(parsed)).toMatchObject({
      title: 'System design: read chapter 1',
      dueDate: '2026-10-11',
      priority: 'medium',
      tags: ['system-design'],
    });
  });

  it('adds days across month and year boundaries', () => {
    expect(addDaysISO('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('task schemas', () => {
  it('applies defaults and normalizes', () => {
    expect(createTaskSchema.parse({ title: '  Two Sum  ', tags: ['DSA', 'dsa'], dueDate: '' })).toEqual({
      title: 'Two Sum',
      notes: '',
      dueDate: null,
      priority: 'none',
      tags: ['dsa'],
    });
  });

  it('rejects bad tags, empty titles and empty patches', () => {
    expect(createTaskSchema.safeParse({ title: '' }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: 'x', tags: ['has space'] }).success).toBe(false);
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
    expect(updateTaskSchema.parse({ done: true })).toEqual({ done: true });
  });
});

describe('parseQuickAdd robustness', () => {
  it('never throws and always returns a non-empty title for non-empty input', () => {
    const vocab = [
      'oct', '31', '0', '99', 'feb', '29', 'next', 'fri', 'in', '3', 'days', 'w', '#', '#dsa',
      '!', '!high', 'today', 'tomorrow', 'on', 'by', '2026-02-30', '.', ',', 'LC', 'x', '  ',
    ];
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let i = 0; i < 3000; i++) {
      const words = Array.from({ length: 1 + Math.floor(rand() * 6) }, () => vocab[Math.floor(rand() * vocab.length)]);
      const input = words.join(rand() < 0.5 ? ' ' : '');
      const out = parseQuickAdd(input, TODAY);
      if (input.trim()) expect(out.title.length).toBeGreaterThan(0);
      if (out.dueDate) expect(out.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
