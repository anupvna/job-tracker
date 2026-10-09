import {
  createApplicationSchema,
  createTaskSchema,
  type CreateApplicationInput,
  type CreateTaskInput,
} from '@job-tracker/shared';
import type { ApplicationsRepository } from '../modules/applications/applications.repository.js';
import type { TasksRepository } from '../modules/tasks/tasks.repository.js';
import { todayISO } from '../lib/dates.js';

/** ISO date `offset` days from today (negative = past). */
function day(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return todayISO(d);
}

export function sampleApplications(): CreateApplicationInput[] {
  return [
    {
      company: 'Stripe',
      role: 'Software Engineer, New Grad',
      link: 'https://stripe.com/jobs',
      status: 'interviewing',
      appliedDate: day(-21),
      followUpDate: day(2),
      notes: 'Passed OA. Virtual onsite scheduled — 2x coding, 1x system design, 1x behavioral.',
      referralName: 'Priya Shah',
      referralStatus: 'referred',
    },
    {
      company: 'Datadog',
      role: 'Software Engineer I — Backend',
      link: 'https://careers.datadoghq.com',
      status: 'applied',
      appliedDate: day(-12),
      followUpDate: day(-2),
      notes: 'Applied through NYU Handshake. Ping recruiter if no update.',
      referralName: 'Marcus Lee',
      referralStatus: 'asked',
    },
    {
      company: 'Figma',
      role: 'Software Engineer, Early Career',
      link: 'https://www.figma.com/careers',
      status: 'wishlist',
      followUpDate: day(0),
      notes: 'Apps open in October. Polish the portfolio project first.',
      referralStatus: 'not_asked',
    },
    {
      company: 'Ramp',
      role: 'Software Engineer — Product',
      status: 'offer',
      appliedDate: day(-40),
      notes: 'Offer received. Deadline in two weeks.',
      referralName: 'Alex Kim',
      referralStatus: 'referred',
    },
    {
      company: 'Cloudflare',
      role: 'Systems Engineer, New Grad 2027',
      status: 'applied',
      appliedDate: day(-8),
      followUpDate: day(6),
      referralStatus: 'not_asked',
    },
    {
      company: 'Two Sigma',
      role: 'Software Engineer',
      status: 'rejected',
      appliedDate: day(-30),
      notes: 'Rejected after the phone screen. Review DP + concurrency questions.',
      referralStatus: 'not_asked',
    },
    {
      company: 'Notion',
      role: 'Software Engineer, New Grad',
      status: 'interviewing',
      appliedDate: day(-15),
      followUpDate: day(-5),
      notes: 'Recruiter call went well. Waiting on technical screen date.',
      referralName: 'Jordan Rivera',
      referralStatus: 'asked',
    },
  ];
}

export async function seed(repo: ApplicationsRepository, userId: string) {
  const items = sampleApplications().map((a) => createApplicationSchema.parse(a));
  for (const item of items) await repo.create(userId, item);
  return items.length;
}

/** Prep planner examples for demo sandboxes. */
export function sampleTasks(): CreateTaskInput[] {
  return [
    { title: 'Update resume with internship metrics', dueDate: day(-1), priority: 'medium', tags: ['resume'] },
    { title: 'Solve 2 LeetCode mediums', dueDate: day(0), priority: 'high', tags: ['dsa'] },
    { title: 'Revise Two Sum and Valid Anagram', dueDate: day(0), tags: ['dsa', 'revision'] },
    { title: 'Mock interview with a classmate', dueDate: day(1), priority: 'high', tags: ['mock'] },
    { title: 'Read a system design primer: load balancers', dueDate: day(3), tags: ['system-design'] },
    { title: 'Write 3 STAR stories for behavioral rounds', priority: 'medium', tags: ['behavioral'] },
    { title: 'Polish GitHub README for the job tracker project', tags: ['portfolio'] },
  ];
}

export async function seedTasks(repo: TasksRepository, userId: string) {
  const items = sampleTasks().map((t) => createTaskSchema.parse(t));
  for (const item of items) await repo.create(userId, item);
  return items.length;
}
