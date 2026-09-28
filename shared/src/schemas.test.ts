import { describe, expect, it } from 'vitest';
import { createApplicationSchema, updateApplicationSchema } from './schemas.js';
import { getFollowUpState } from './followUp.js';

describe('createApplicationSchema', () => {
  it('applies defaults and normalizes empty strings to null', () => {
    const parsed = createApplicationSchema.parse({
      company: '  Stripe ',
      role: 'Software Engineer, New Grad',
      link: '',
      appliedDate: '',
      referralName: '   ',
    });
    expect(parsed).toEqual({
      company: 'Stripe',
      role: 'Software Engineer, New Grad',
      link: null,
      status: 'wishlist',
      appliedDate: null,
      followUpDate: null,
      notes: '',
      referralName: null,
      referralStatus: 'not_asked',
    });
  });

  it('adds https:// to bare domains', () => {
    const parsed = createApplicationSchema.parse({
      company: 'Acme',
      role: 'SWE',
      link: 'jobs.acme.com/123',
    });
    expect(parsed.link).toBe('https://jobs.acme.com/123');
  });

  it('rejects missing company, bad dates and unknown statuses', () => {
    const result = createApplicationSchema.safeParse({
      company: '',
      role: 'SWE',
      appliedDate: '2026-13-45',
      status: 'ghosted',
    });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['company', 'appliedDate', 'status']));
  });
});

describe('updateApplicationSchema', () => {
  it('keeps omitted fields undefined so PATCH does not clear them', () => {
    const parsed = updateApplicationSchema.parse({ status: 'applied' });
    expect(parsed).toEqual({ status: 'applied' });
  });

  it('allows explicitly clearing a field', () => {
    expect(updateApplicationSchema.parse({ followUpDate: null })).toEqual({ followUpDate: null });
  });

  it('rejects an empty body', () => {
    expect(updateApplicationSchema.safeParse({}).success).toBe(false);
  });
});

describe('getFollowUpState', () => {
  const today = '2026-09-28';
  it.each([
    [{ followUpDate: '2026-09-27', status: 'applied' as const }, 'overdue'],
    [{ followUpDate: '2026-09-28', status: 'applied' as const }, 'today'],
    [{ followUpDate: '2026-10-01', status: 'interviewing' as const }, 'upcoming'],
    [{ followUpDate: '2026-09-01', status: 'rejected' as const }, 'none'],
    [{ followUpDate: null, status: 'applied' as const }, 'none'],
  ])('%o → %s', (app, expected) => {
    expect(getFollowUpState(app, today)).toBe(expected);
  });
});
