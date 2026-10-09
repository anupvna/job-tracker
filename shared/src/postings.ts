import { z } from 'zod';

/*
 * Job postings: recognise links from applicant-tracking systems that publish a free public
 * job API (Greenhouse, Lever, Ashby). The server only ever calls those fixed API hosts with
 * ids parsed here — never an arbitrary user-supplied URL.
 */

export const POSTING_SOURCES = ['greenhouse', 'lever', 'ashby'] as const;
export type PostingSource = (typeof POSTING_SOURCES)[number];
export type SnapshotSource = PostingSource | 'manual';

export const POSTING_SOURCE_LABELS: Record<SnapshotSource, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  manual: 'Pasted',
};

export interface PostingRef {
  source: PostingSource;
  /** Company slug on the job board (Greenhouse "board token", Lever site, Ashby org). */
  board: string;
  /** Posting id on that board. */
  id: string;
  /** Lever has a separate EU data centre. */
  region?: 'eu';
}

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const NUMERIC_ID = /^\d{1,20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parse a job link into a posting reference, or null if it isn't a supported board. */
export function parsePostingUrl(raw: string | null | undefined): PostingRef | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });

  // Greenhouse: boards.greenhouse.io/{board}/jobs/{id} (also job-boards.*), or the embed form.
  if (host === 'boards.greenhouse.io' || host === 'job-boards.greenhouse.io') {
    if (parts[0] === 'embed') {
      const board = url.searchParams.get('for') ?? '';
      const id = url.searchParams.get('token') ?? '';
      return SLUG.test(board) && NUMERIC_ID.test(id) ? { source: 'greenhouse', board, id } : null;
    }
    const [board, jobs, id] = parts;
    if (board && jobs === 'jobs' && id && SLUG.test(board) && NUMERIC_ID.test(id)) {
      return { source: 'greenhouse', board, id };
    }
    return null;
  }

  // Lever: jobs.lever.co/{site}/{uuid}[/apply] (EU: jobs.eu.lever.co).
  if (host === 'jobs.lever.co' || host === 'jobs.eu.lever.co') {
    const [board, id] = parts;
    if (board && id && SLUG.test(board) && UUID.test(id)) {
      return { source: 'lever', board, id: id.toLowerCase(), ...(host.includes('.eu.') ? { region: 'eu' as const } : {}) };
    }
    return null;
  }

  // Ashby: jobs.ashbyhq.com/{org}/{uuid}[/application].
  if (host === 'jobs.ashbyhq.com') {
    const [board, id] = parts;
    if (board && id && SLUG.test(board) && UUID.test(id)) {
      return { source: 'ashby', board, id: id.toLowerCase() };
    }
    return null;
  }

  return null;
}

/** Stable key for a posting, e.g. "lever:palantir:6ed7…". */
export function postingKey(ref: PostingRef): string {
  return `${ref.source}:${ref.board.toLowerCase()}:${ref.id}`;
}

/** "acme-robotics" → "Acme Robotics" (used when the board doesn't return a company name). */
export function titleizeSlug(slug: string): string {
  return slug
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}

export const POSTING_LIMITS = { description: 100_000, title: 300 } as const;

/** POST /api/job-postings/lookup */
export const postingLookupSchema = z.object({
  url: z.string().trim().min(1, 'Paste a job link').max(2048),
});

/** PUT /api/applications/:id/snapshot — paste the description for boards we can't fetch. */
export const manualSnapshotSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Paste the job description')
    .max(POSTING_LIMITS.description, 'That description is too long'),
});

export interface PostingDetails {
  source: PostingSource;
  company: string;
  title: string;
  location: string | null;
  /** Plain text (HTML converted), capped at POSTING_LIMITS.description. */
  description: string;
  postedAt: string | null;
  url: string | null;
}

export type PostingLookupResult =
  | { supported: false }
  | { supported: true; status: 'closed'; source: PostingSource }
  | { supported: true; status: 'open'; posting: PostingDetails };

export type PostingStatus = 'open' | 'closed' | 'unknown';

export interface JobSnapshot {
  applicationId: string;
  source: SnapshotSource;
  title: string | null;
  company: string | null;
  location: string | null;
  description: string;
  postedAt: string | null;
  fetchedAt: string;
  postingStatus: PostingStatus;
  lastCheckedAt: string | null;
  closedAt: string | null;
}

/** Lightweight per-application status for table badges. */
export type SnapshotSummary = Pick<
  JobSnapshot,
  'applicationId' | 'source' | 'postingStatus' | 'fetchedAt' | 'lastCheckedAt' | 'closedAt'
>;

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', bull: '•', middot: '·',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/**
 * Convert job-board HTML to readable plain text. We never render posting HTML — only text —
 * so there's nothing to sanitize on the way into the page.
 */
export function htmlToText(html: string): string {
  let s = html;
  // Greenhouse double-escapes: "&lt;p&gt;" → "<p>".
  if (!/<[a-z]/i.test(s) && /&lt;[a-z/]/i.test(s)) s = decodeEntities(s);
  s = s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li(\s[^>]*)?>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<\/(p|div|h[1-6]|ul|ol|tr|section|article)>/gi, '\n')
    .replace(/<(p|div|h[1-6]|ul|ol|tr|section|article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return tidyText(decodeEntities(s));
}

/** Normalise plain text (no HTML parsing, so "a < b" survives): whitespace, blank lines, cap. */
export function tidyText(text: string): string {
  const s = text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s.length > POSTING_LIMITS.description ? s.slice(0, POSTING_LIMITS.description) : s;
}
