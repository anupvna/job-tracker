import { z } from 'zod';
import {
  APPLICATION_STATUSES,
  LIMITS,
  REFERRAL_STATUSES,
  SORT_FIELDS,
  type ApplicationStatus,
  type ReferralStatus,
} from './constants.js';

/*
 * Single source of truth for the API contract. The server validates requests with these
 * schemas and the client validates its forms with the exact same ones.
 */

export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);
export const referralStatusSchema = z.enum(REFERRAL_STATUSES);

/** Optional free text: trims, and treats empty strings as null. */
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .nullable()
    .transform((v) => (v ? v : null));

/** Calendar date (YYYY-MM-DD) or null. Empty strings from form inputs become null. */
const nullableDate = z
  .union([z.iso.date({ message: 'Use a valid date (YYYY-MM-DD)' }), z.literal(''), z.null()])
  .transform((v) => (v ? v : null));

/** Job posting URL. Adds https:// if the user pasted a bare domain. */
const nullableLink = z
  .string()
  .trim()
  .max(LIMITS.link)
  .nullable()
  .transform((v) => {
    if (!v) return null;
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  })
  .pipe(z.url({ protocol: /^https?$/, message: 'Enter a valid URL' }).nullable());

const fields = {
  company: z
    .string()
    .trim()
    .min(1, 'Company is required')
    .max(LIMITS.company, `Must be ${LIMITS.company} characters or fewer`),
  role: z
    .string()
    .trim()
    .min(1, 'Role is required')
    .max(LIMITS.role, `Must be ${LIMITS.role} characters or fewer`),
  link: nullableLink,
  status: applicationStatusSchema,
  appliedDate: nullableDate,
  followUpDate: nullableDate,
  notes: z.string().trim().max(LIMITS.notes, `Must be ${LIMITS.notes} characters or fewer`),
  referralName: nullableText(LIMITS.referralName),
  referralStatus: referralStatusSchema,
};

/** POST /api/applications */
export const createApplicationSchema = z.object({
  company: fields.company,
  role: fields.role,
  link: fields.link.default(null),
  status: fields.status.default('wishlist'),
  appliedDate: fields.appliedDate.default(null),
  followUpDate: fields.followUpDate.default(null),
  notes: fields.notes.default(''),
  referralName: fields.referralName.default(null),
  referralStatus: fields.referralStatus.default('not_asked'),
});

/** PATCH /api/applications/:id — every field optional, at least one required. */
export const updateApplicationSchema = z
  .object(fields)
  .partial()
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });

/** GET /api/applications query string */
export const listApplicationsQuerySchema = z.object({
  status: applicationStatusSchema.optional(),
  q: z.string().trim().max(LIMITS.search).optional(),
  overdue: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  /** The caller's local date, so "overdue" matches the user's timezone. */
  today: z.iso.date().optional(),
  sort: z.enum(SORT_FIELDS).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const statsQuerySchema = z.object({
  today: z.iso.date().optional(),
});

export const idParamSchema = z.object({
  id: z.uuid({ message: 'Invalid application id' }),
});

export type CreateApplicationInput = z.input<typeof createApplicationSchema>;
export type CreateApplication = z.output<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.input<typeof updateApplicationSchema>;
export type UpdateApplication = z.output<typeof updateApplicationSchema>;
export type ListApplicationsQuery = z.output<typeof listApplicationsQuerySchema>;

/** An application as returned by the API. */
export interface Application {
  id: string;
  company: string;
  role: string;
  link: string | null;
  status: ApplicationStatus;
  appliedDate: string | null;
  followUpDate: string | null;
  notes: string;
  referralName: string | null;
  referralStatus: ReferralStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationStats {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  overdueFollowUps: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
  };
}
