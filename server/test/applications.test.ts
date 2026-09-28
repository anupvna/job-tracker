import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Application } from '@job-tracker/shared';
import { migrate } from '../src/db/migrate.js';
import { client, db, resetDb, signedInClient, type Client } from './helpers.js';

// Every test runs as a freshly signed-up user.
let agent: Client;
const api = () => agent;

const TODAY = '2026-09-28';

async function create(body: Record<string, unknown>): Promise<Application> {
  const res = await api().post('/api/applications').send(body).expect(201);
  return res.body;
}

beforeAll(async () => {
  await migrate(db);
});

beforeEach(async () => {
  await resetDb();
  agent = await signedInClient();
});

afterAll(async () => {
  await db.end();
});

describe('authentication guard', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await client().get('/api/applications').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    const res = await api().get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/applications', () => {
  it('creates an application with defaults', async () => {
    const res = await api()
      .post('/api/applications')
      .send({ company: 'Stripe', role: 'SWE, New Grad', link: 'stripe.com/jobs' })
      .expect(201);

    expect(res.headers.location).toBe(`/api/applications/${res.body.id}`);
    expect(res.body).toMatchObject({
      company: 'Stripe',
      role: 'SWE, New Grad',
      link: 'https://stripe.com/jobs',
      status: 'wishlist',
      referralStatus: 'not_asked',
      referralName: null,
      appliedDate: null,
      notes: '',
    });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('round-trips dates without timezone drift', async () => {
    const app = await create({
      company: 'Datadog',
      role: 'SWE I',
      appliedDate: '2026-01-01',
      followUpDate: '2026-01-15',
    });
    expect(app.appliedDate).toBe('2026-01-01');
    expect(app.followUpDate).toBe('2026-01-15');
  });

  it('returns 400 with field details for invalid input', async () => {
    const res = await api()
      .post('/api/applications')
      .send({ company: '', role: 'SWE', status: 'ghosted', link: 'not a url' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['company', 'status', 'link']));
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await api()
      .post('/api/applications')
      .set('Content-Type', 'application/json')
      .send('{"company":')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('GET /api/applications', () => {
  beforeEach(async () => {
    await create({
      company: 'Acme',
      role: 'Backend',
      status: 'applied',
      followUpDate: '2026-09-20',
    });
    await create({
      company: 'Globex',
      role: 'Frontend',
      status: 'interviewing',
      followUpDate: '2026-10-05',
    });
    await create({
      company: 'Initech',
      role: 'Platform',
      status: 'rejected',
      followUpDate: '2026-09-01',
    });
    await create({
      company: 'Umbrella',
      role: 'Fullstack',
      status: 'wishlist',
      referralName: 'Ada Lovelace',
    });
  });

  it('lists everything', async () => {
    const res = await api().get('/api/applications').expect(200);
    expect(res.body).toHaveLength(4);
  });

  it('filters by status', async () => {
    const res = await api().get('/api/applications?status=interviewing').expect(200);
    expect(res.body.map((a: Application) => a.company)).toEqual(['Globex']);
  });

  it('searches company, role and referral name case-insensitively', async () => {
    const byRole = await api().get('/api/applications?q=front').expect(200);
    expect(byRole.body.map((a: Application) => a.company)).toEqual(['Globex']);
    const byReferral = await api().get('/api/applications?q=lovelace').expect(200);
    expect(byReferral.body.map((a: Application) => a.company)).toEqual(['Umbrella']);
  });

  it('treats LIKE wildcards in search as literal text', async () => {
    const res = await api().get('/api/applications?q=%25').expect(200);
    expect(res.body).toHaveLength(0);
  });

  it('returns only open applications with past follow-ups when overdue=true', async () => {
    const res = await api().get(`/api/applications?overdue=true&today=${TODAY}`).expect(200);
    expect(res.body.map((a: Application) => a.company)).toEqual(['Acme']);
  });

  it('sorts by pipeline stage, not alphabetically', async () => {
    const res = await api().get('/api/applications?sort=status&order=asc').expect(200);
    expect(res.body.map((a: Application) => a.status)).toEqual([
      'wishlist',
      'applied',
      'interviewing',
      'rejected',
    ]);
  });

  it('rejects unknown sort fields', async () => {
    await api().get('/api/applications?sort=password').expect(400);
  });
});

describe('GET /api/applications/stats', () => {
  it('counts per status and overdue follow-ups', async () => {
    await create({ company: 'A', role: 'r', status: 'applied', followUpDate: '2026-09-01' });
    await create({ company: 'B', role: 'r', status: 'applied' });
    await create({ company: 'C', role: 'r', status: 'offer', followUpDate: '2026-09-01' });

    const res = await api().get(`/api/applications/stats?today=${TODAY}`).expect(200);
    expect(res.body).toEqual({
      total: 3,
      byStatus: { wishlist: 0, applied: 2, interviewing: 0, offer: 1, rejected: 0 },
      overdueFollowUps: 1,
    });
  });
});

describe('GET/PATCH/DELETE /api/applications/:id', () => {
  it('fetches one application', async () => {
    const created = await create({ company: 'Figma', role: 'SWE' });
    const res = await api().get(`/api/applications/${created.id}`).expect(200);
    expect(res.body.company).toBe('Figma');
  });

  it('partially updates without clearing omitted fields', async () => {
    const created = await create({
      company: 'Ramp',
      role: 'SWE',
      notes: 'Keep me',
      referralName: 'Alex',
      referralStatus: 'asked',
    });
    const res = await api()
      .patch(`/api/applications/${created.id}`)
      .send({ status: 'offer', referralStatus: 'referred' })
      .expect(200);

    expect(res.body).toMatchObject({
      status: 'offer',
      referralStatus: 'referred',
      notes: 'Keep me',
      referralName: 'Alex',
    });
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updatedAt).getTime(),
    );
  });

  it('can clear a nullable field', async () => {
    const created = await create({ company: 'X', role: 'Y', followUpDate: '2026-10-01' });
    const res = await api()
      .patch(`/api/applications/${created.id}`)
      .send({ followUpDate: null })
      .expect(200);
    expect(res.body.followUpDate).toBeNull();
  });

  it('rejects an empty patch', async () => {
    const created = await create({ company: 'X', role: 'Y' });
    await api().patch(`/api/applications/${created.id}`).send({}).expect(400);
  });

  it('deletes and then 404s', async () => {
    const created = await create({ company: 'X', role: 'Y' });
    await api().delete(`/api/applications/${created.id}`).expect(204);
    await api().get(`/api/applications/${created.id}`).expect(404);
    await api().delete(`/api/applications/${created.id}`).expect(404);
  });

  it('400s on a malformed id', async () => {
    const res = await api().get('/api/applications/not-a-uuid').expect(400);
    expect(res.body.error.details[0].path).toBe('id');
  });
});

describe('POST /api/applications/sample-data', () => {
  it('seeds an empty tracker once', async () => {
    const res = await api().post('/api/applications/sample-data').expect(201);
    expect(res.body.inserted).toBeGreaterThan(0);
    await api().post('/api/applications/sample-data').expect(409);
  });
});

describe('unknown API routes', () => {
  it('return a JSON 404', async () => {
    const res = await api().get('/api/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
