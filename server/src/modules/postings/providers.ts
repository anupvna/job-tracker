import {
  htmlToText,
  tidyText,
  titleizeSlug,
  type PostingDetails,
  type PostingRef,
} from '@job-tracker/shared';
import { z } from 'zod';

/*
 * Clients for the public job-board APIs. URLs are always built from a fixed host plus ids that
 * parsePostingUrl() has already validated — user input is never used as a URL (no SSRF).
 */

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export type FetchResult = { status: 'open'; posting: PostingDetails } | { status: 'closed' };

export class PostingFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostingFetchError';
  }
}

const TIMEOUT_MS = 5000;
const MAX_BYTES = 5_000_000;

/** GET JSON; null on 404 (posting gone); throws PostingFetchError on anything else unexpected. */
async function getJson(fetcher: Fetcher, url: string): Promise<unknown | null> {
  let res: Response;
  try {
    res = await fetcher(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'JobTracker/1.0 (personal job-search tracker)' },
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new PostingFetchError(`Couldn't reach the job board (${(err as Error).name})`);
  }
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new PostingFetchError(`Job board responded with HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new PostingFetchError('Job board response was too large');
  try {
    return JSON.parse(text);
  } catch {
    throw new PostingFetchError('Job board returned something that was not JSON');
  }
}

const enc = encodeURIComponent;
const str = z.string().nullish();

const greenhouseJob = z.object({
  title: z.string(),
  company_name: str,
  location: z.object({ name: str }).nullish(),
  content: str,
  first_published: str,
  updated_at: str,
  absolute_url: str,
});

const leverPosting = z.object({
  text: z.string(),
  categories: z.object({ location: str, team: str, commitment: str }).partial().nullish(),
  description: str,
  descriptionPlain: str,
  lists: z.array(z.object({ text: str, content: str })).nullish(),
  additional: str,
  additionalPlain: str,
  hostedUrl: str,
  createdAt: z.number().nullish(),
});

const ashbyBoard = z.object({
  jobs: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      location: str,
      descriptionPlain: str,
      descriptionHtml: str,
      publishedAt: str,
      jobUrl: str,
    }),
  ),
});

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new PostingFetchError('Job board returned an unexpected format');
  return result.data;
}

const iso = (s: string | null | undefined) => {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

async function greenhouse(ref: PostingRef, fetcher: Fetcher): Promise<FetchResult> {
  const data = await getJson(fetcher, `https://boards-api.greenhouse.io/v1/boards/${enc(ref.board)}/jobs/${enc(ref.id)}`);
  if (data === null) return { status: 'closed' };
  const job = parse(greenhouseJob, data);
  return {
    status: 'open',
    posting: {
      source: 'greenhouse',
      company: job.company_name?.trim() || titleizeSlug(ref.board),
      title: job.title.trim(),
      location: job.location?.name?.trim() || null,
      description: htmlToText(job.content ?? ''),
      postedAt: iso(job.first_published ?? job.updated_at),
      url: job.absolute_url ?? null,
    },
  };
}

async function lever(ref: PostingRef, fetcher: Fetcher): Promise<FetchResult> {
  const host = ref.region === 'eu' ? 'https://api.eu.lever.co' : 'https://api.lever.co';
  const data = await getJson(fetcher, `${host}/v0/postings/${enc(ref.board)}/${enc(ref.id)}?mode=json`);
  if (data === null) return { status: 'closed' };
  const p = parse(leverPosting, data);
  const sections = [
    p.descriptionPlain ? tidyText(p.descriptionPlain) : htmlToText(p.description ?? ''),
    ...(p.lists ?? []).map((l) => [tidyText(l.text ?? ''), htmlToText(l.content ?? '')].filter(Boolean).join('\n')),
    p.additionalPlain ? tidyText(p.additionalPlain) : htmlToText(p.additional ?? ''),
  ].filter(Boolean);
  return {
    status: 'open',
    posting: {
      source: 'lever',
      company: titleizeSlug(ref.board),
      title: p.text.trim(),
      location: p.categories?.location?.trim() || null,
      description: tidyText(sections.join('\n\n')),
      postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      url: p.hostedUrl ?? null,
    },
  };
}

async function ashby(ref: PostingRef, fetcher: Fetcher): Promise<FetchResult> {
  const data = await getJson(fetcher, `https://api.ashbyhq.com/posting-api/job-board/${enc(ref.board)}`);
  if (data === null) return { status: 'closed' };
  const job = parse(ashbyBoard, data).jobs.find((j) => j.id.toLowerCase() === ref.id);
  if (!job) return { status: 'closed' };
  return {
    status: 'open',
    posting: {
      source: 'ashby',
      company: titleizeSlug(ref.board),
      title: job.title.trim(),
      location: job.location?.trim() || null,
      description: job.descriptionPlain?.trim()
        ? tidyText(job.descriptionPlain)
        : htmlToText(job.descriptionHtml ?? ''),
      postedAt: iso(job.publishedAt),
      url: job.jobUrl ?? null,
    },
  };
}

export function fetchPosting(ref: PostingRef, fetcher: Fetcher = fetch): Promise<FetchResult> {
  switch (ref.source) {
    case 'greenhouse':
      return greenhouse(ref, fetcher);
    case 'lever':
      return lever(ref, fetcher);
    case 'ashby':
      return ashby(ref, fetcher);
  }
}
