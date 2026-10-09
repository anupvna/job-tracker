import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Task } from '@job-tracker/shared';
import { migrate } from '../src/db/migrate.js';
import { client, db, resetDb, signedInClient, type Client } from './helpers.js';

const TODAY = '2026-10-09';
let agent: Client;

async function create(body: Record<string, unknown>): Promise<Task> {
  const res = await agent.post('/api/tasks').send(body).expect(201);
  return res.body;
}

async function list(view: string): Promise<Task[]> {
  const res = await agent.get(`/api/tasks?view=${view}&today=${TODAY}`).expect(200);
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

describe('tasks API', () => {
  it('requires a session', async () => {
    await client().get(`/api/tasks?today=${TODAY}`).expect(401);
  });

  it('creates a task with defaults and normalized tags', async () => {
    const res = await agent
      .post('/api/tasks')
      .send({ title: '  Two Sum ', tags: ['DSA', 'dsa'] })
      .expect(201);
    expect(res.headers.location).toBe(`/api/tasks/${res.body.id}`);
    expect(res.body).toMatchObject({
      title: 'Two Sum',
      notes: '',
      dueDate: null,
      priority: 'none',
      tags: ['dsa'],
      doneAt: null,
    });
  });

  it('rejects invalid input with field details', async () => {
    const res = await agent
      .post('/api/tasks')
      .send({ title: '', dueDate: '2026-02-30', priority: 'urgent' })
      .expect(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['title', 'dueDate', 'priority']));
  });

  it('sorts tasks into today / upcoming / someday views', async () => {
    await create({ title: 'Overdue', dueDate: '2026-10-01' });
    await create({ title: 'Today low', dueDate: TODAY, priority: 'low' });
    await create({ title: 'Today high', dueDate: TODAY, priority: 'high' });
    await create({ title: 'Later', dueDate: '2026-10-20' });
    await create({ title: 'Soon', dueDate: '2026-10-10' });
    await create({ title: 'No date' });

    expect((await list('today')).map((t) => t.title)).toEqual(['Overdue', 'Today high', 'Today low']);
    expect((await list('upcoming')).map((t) => t.title)).toEqual(['Soon', 'Later']);
    expect((await list('someday')).map((t) => t.title)).toEqual(['No date']);

    const counts = await agent.get(`/api/tasks/counts?today=${TODAY}`).expect(200);
    expect(counts.body).toEqual({ today: 3, overdue: 1, upcoming: 2, someday: 1 });
  });

  it('completes and reopens a task, keeping the original completion time', async () => {
    const t = await create({ title: 'Mock interview', dueDate: TODAY });

    const done = await agent.patch(`/api/tasks/${t.id}`).send({ done: true }).expect(200);
    expect(done.body.doneAt).toEqual(expect.any(String));
    expect(await list('today')).toEqual([]);
    expect((await list('done')).map((x) => x.id)).toEqual([t.id]);

    const again = await agent.patch(`/api/tasks/${t.id}`).send({ done: true, title: 'Mock #1' });
    expect(again.body.doneAt).toBe(done.body.doneAt);
    expect(again.body.title).toBe('Mock #1');

    const reopened = await agent.patch(`/api/tasks/${t.id}`).send({ done: false }).expect(200);
    expect(reopened.body.doneAt).toBeNull();
    expect((await list('today')).map((x) => x.id)).toEqual([t.id]);
  });

  it('edits fields and can clear the due date', async () => {
    const t = await create({ title: 'Read', dueDate: TODAY, tags: ['sd'] });
    const res = await agent
      .patch(`/api/tasks/${t.id}`)
      .send({ dueDate: null, priority: 'medium', tags: [], notes: 'Chapter 1' })
      .expect(200);
    expect(res.body).toMatchObject({ dueDate: null, priority: 'medium', tags: [], notes: 'Chapter 1' });
    expect(res.body.updatedAt >= t.updatedAt).toBe(true);
    await agent.patch(`/api/tasks/${t.id}`).send({}).expect(400);
  });

  it('deletes a task', async () => {
    const t = await create({ title: 'Temp' });
    await agent.delete(`/api/tasks/${t.id}`).expect(204);
    await agent.delete(`/api/tasks/${t.id}`).expect(404);
  });

  it("never exposes or changes another user's tasks", async () => {
    const mine = await create({ title: 'Private', dueDate: TODAY });
    const other = await signedInClient('Someone Else');

    const theirs = await other.get(`/api/tasks?view=today&today=${TODAY}`).expect(200);
    expect(theirs.body).toEqual([]);
    await other.patch(`/api/tasks/${mine.id}`).send({ done: true }).expect(404);
    await other.delete(`/api/tasks/${mine.id}`).expect(404);

    expect((await list('today')).map((t) => t.id)).toEqual([mine.id]);
  });

  it('validates query params and ids', async () => {
    await agent.get('/api/tasks?view=today').expect(400); // missing today
    await agent.get(`/api/tasks?view=nope&today=${TODAY}`).expect(400);
    await agent.patch('/api/tasks/not-a-uuid').send({ done: true }).expect(400);
  });

  it('gives demo sandboxes sample tasks', async () => {
    const demo = client();
    await demo.post('/api/auth/demo').expect(201);
    const today = new Date().toISOString().slice(0, 10);
    const counts = await demo.get(`/api/tasks/counts?today=${today}`).expect(200);
    const total = counts.body.today + counts.body.upcoming + counts.body.someday;
    expect(total).toBeGreaterThanOrEqual(5);
  });

  it('removes tasks when the account is deleted (cascade)', async () => {
    await create({ title: 'Will vanish' });
    await db.query('DELETE FROM users');
    const { rows } = await db.query('SELECT count(*)::int AS n FROM tasks');
    expect(rows[0].n).toBe(0);
  });
});
