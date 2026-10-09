import {
  createApplicationSchema,
  NEETCODE_150,
  countStudyDays,
  createTaskSchema,
  type CreateApplicationInput,
  type CreateTaskInput,
  type ReviewRating,
} from '@job-tracker/shared';
import type { ApplicationsRepository } from '../modules/applications/applications.repository.js';
import type { StudyPlansRepository } from '../modules/studyPlans/studyPlans.repository.js';
import { ProgressService } from '../modules/studyPlans/studyPlans.service.js';
import type { SnapshotsRepository } from '../modules/postings/snapshots.repository.js';
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
      appliedDate: day(0),
      followUpDate: day(7),
      notes: 'Referred by a former teammate from my internship.',
      referralName: 'Sam Patel',
      referralStatus: 'referred',
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

/**
 * Demo sandboxes get a NeetCode 150 plan already in progress: started 12 days ago at a medium
 * pace, a little behind, one of today's problems done, and a realistic revision history (some
 * reviews kept up with, a few now due) — so every part of the Prep tab has something to show.
 */
export async function seedStudyPlan(repo: StudyPlansRepository, userId: string) {
  const progress = new ProgressService(repo);
  const studyDays = [1, 2, 3, 4, 5, 6];
  const startDate = day(-12);
  const today = day(0);
  const missed = new Set([day(-4), day(-3)]);
  await repo.upsertPlan(userId, 'neetcode150', { pace: 'medium', studyDays, startDate });

  // Solve 3 per study day up to yesterday (skipping two days), then one problem today.
  const solved: { slug: string; on: string; rating: ReviewRating }[] = [];
  let next = 0;
  for (let offset = -12; offset < 0; offset++) {
    const date = day(offset);
    if (countStudyDays(date, date, studyDays) === 0 || missed.has(date)) continue;
    for (let i = 0; i < 3; i++) {
      const rating: ReviewRating = next % 5 === 4 ? 'hard' : next % 4 === 3 ? 'easy' : 'ok';
      solved.push({ slug: NEETCODE_150[next++]!.slug, on: date, rating });
    }
  }
  solved.push({ slug: NEETCODE_150[next]!.slug, on: today, rating: 'ok' });

  for (const s of solved) {
    let state = await progress.solve(userId, s.slug, s.on, s.rating);
    // Keep up with reviews on the days the "user" studied; anything landing today or on a
    // missed day is left due.
    while (state.nextReviewOn && state.nextReviewOn < today && !missed.has(state.nextReviewOn)) {
      state = await progress.review(userId, s.slug, 'ok', state.nextReviewOn);
    }
  }
  return solved.length;
}

/**
 * Demo sandboxes: one application with a saved (pasted) job description, and one whose posting
 * has "been taken down", so the badge and saved copy are visible. Demo users are never included
 * in the real daily posting checks.
 */
export async function seedSnapshots(repo: SnapshotsRepository, apps: ApplicationsRepository, userId: string) {
  const list = await apps.list(userId, { sort: 'createdAt', order: 'asc', today: day(0) });
  const stripe = list.find((a) => a.company === 'Stripe');
  const datadog = list.find((a) => a.company === 'Datadog');
  if (stripe) {
    await repo.saveManual(
      userId,
      stripe.id,
      [
        'Software Engineer, New Grad',
        '',
        'About the role',
        'You will build and scale the systems that move money for millions of businesses.',
        '',
        'What you’ll do',
        '• Design, build and operate backend services in Ruby, Java or Go',
        '• Debug production issues across distributed systems',
        '• Work closely with product and design on new features',
        '',
        'Who you are',
        '• BS/MS in Computer Science or similar, graduating by mid-2027',
        '• Strong fundamentals in data structures, algorithms and systems',
        '• Internship experience building production software',
      ].join('\n'),
    );
  }
  if (datadog) {
    await repo.saveFetched(userId, datadog.id, { source: 'greenhouse', board: 'datadog', id: '1000001' }, {
      source: 'greenhouse',
      company: 'Datadog',
      title: 'Software Engineer I — Backend',
      location: 'New York, NY',
      description:
        'Datadog is looking for new-grad backend engineers to work on high-throughput data pipelines.\n\n' +
        'Requirements\n• Proficiency in Go, Python or Java\n• Understanding of distributed systems basics\n• Graduating in 2026–2027',
      postedAt: null,
      url: null,
    });
    await repo.recordCheck(datadog.id, 'missing');
    await repo.recordCheck(datadog.id, 'missing');
  }
}
