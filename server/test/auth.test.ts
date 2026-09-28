import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { app, client, db, resetDb, signedInClient } from './helpers.js';

beforeAll(async () => {
  await migrate(db);
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.end();
});

const creds = { name: 'Ada Lovelace', email: 'Ada@Example.com', password: 'analytical-engine' };

function sessionCookie(res: request.Response): string {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = raw.find((c) => c.startsWith('jt_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie;
}

describe('POST /api/auth/signup', () => {
  it('creates an account, normalizes the email and starts a session', async () => {
    const c = client();
    const res = await c.post('/api/auth/signup').send(creds).expect(201);

    expect(res.body).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      isDemo: false,
    });
    expect(res.body).not.toHaveProperty('passwordHash');

    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const me = await c.get('/api/auth/me').expect(200);
    expect(me.body.email).toBe('ada@example.com');
  });

  it('stores only a hash of the password and of the session token', async () => {
    const res = await client().post('/api/auth/signup').send(creds).expect(201);
    const token = sessionCookie(res).split(';')[0]!.split('=')[1]!;

    const { rows: users } = await db.query('SELECT password_hash FROM users');
    expect(users[0].password_hash).toMatch(/^scrypt\$/);
    expect(users[0].password_hash).not.toContain(creds.password);

    const { rows: sessions } = await db.query('SELECT token_hash FROM sessions');
    expect(sessions[0].token_hash).not.toBe(decodeURIComponent(token));
  });

  it('rejects a duplicate email regardless of case', async () => {
    await client().post('/api/auth/signup').send(creds).expect(201);
    const res = await client()
      .post('/api/auth/signup')
      .send({ ...creds, email: 'ADA@example.com' })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('validates input', async () => {
    const res = await client()
      .post('/api/auth/signup')
      .send({ name: '', email: 'nope', password: 'short' })
      .expect(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await client().post('/api/auth/signup').send(creds).expect(201);
  });

  it('logs in with the right password', async () => {
    const c = client();
    await c
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: creds.password })
      .expect(200);
    await c.get('/api/auth/me').expect(200);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const wrong = await client()
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'wrong-password' })
      .expect(401);
    const unknown = await client()
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' })
      .expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });
});

describe('POST /api/auth/logout', () => {
  it('ends the session server-side, not just in the browser', async () => {
    const c = client();
    const res = await c.post('/api/auth/signup').send(creds).expect(201);
    const cookie = sessionCookie(res).split(';')[0]!;

    await c.post('/api/auth/logout').expect(204);

    // Replaying the old cookie must no longer work.
    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
  });
});

describe('CSRF protection', () => {
  it('rejects state-changing requests without the X-Requested-With header', async () => {
    const res = await request(app).post('/api/auth/signup').send(creds).expect(403);
    expect(res.body.error.code).toBe('CSRF');
  });

  it('allows safe methods without the header', async () => {
    await request(app).get('/api/health').expect(200);
  });
});

describe('data isolation between users', () => {
  it("never exposes another user's applications", async () => {
    const alice = await signedInClient('Alice');
    const bob = await signedInClient('Bob');

    const { body: secret } = await alice
      .post('/api/applications')
      .send({ company: 'Secret Co', role: 'SWE', followUpDate: '2020-01-01', status: 'applied' })
      .expect(201);

    // Bob can't list, count, read, edit or delete it — and gets 404, not 403,
    // so he can't even tell the id exists.
    expect((await bob.get('/api/applications').expect(200)).body).toEqual([]);
    expect((await bob.get('/api/applications/stats').expect(200)).body.total).toBe(0);
    await bob.get(`/api/applications/${secret.id}`).expect(404);
    await bob.patch(`/api/applications/${secret.id}`).send({ status: 'offer' }).expect(404);
    await bob.delete(`/api/applications/${secret.id}`).expect(404);

    // Alice's row is untouched.
    const { body } = await alice.get(`/api/applications/${secret.id}`).expect(200);
    expect(body.status).toBe('applied');
  });
});

describe('POST /api/auth/demo', () => {
  it('creates a private, pre-filled sandbox that expires', async () => {
    const c = client();
    const res = await c.post('/api/auth/demo').expect(201);

    expect(res.body.isDemo).toBe(true);
    expect(res.body.email).toBeNull();
    const hoursLeft = (Date.parse(res.body.expiresAt) - Date.now()) / 3_600_000;
    expect(hoursLeft).toBeGreaterThan(23);
    expect(hoursLeft).toBeLessThanOrEqual(24);

    const { body: apps } = await c.get('/api/applications').expect(200);
    expect(apps.length).toBeGreaterThan(0);

    // Each visitor gets their own sandbox.
    const other = client();
    await other.post('/api/auth/demo').expect(201);
    await other.delete(`/api/applications/${apps[0].id}`).expect(404);
  });

  it('purges expired sandboxes along with their data', async () => {
    const c = client();
    await c.post('/api/auth/demo').expect(201);
    await db.query(`UPDATE users SET expires_at = now() - interval '1 minute' WHERE is_demo`);

    // An expired sandbox's session stops working immediately…
    await c.get('/api/auth/me').expect(401);

    // …and the sweep deletes the user, sessions and applications.
    const purged = await app.auth.purgeExpired();
    expect(purged.demoUsers).toBe(1);
    const { rows } = await db.query('SELECT count(*)::int AS n FROM applications');
    expect(rows[0].n).toBe(0);
  });
});
