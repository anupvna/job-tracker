/** Pipeline stages, in the order they appear in the UI. */
export const APPLICATION_STATUSES = [
  'wishlist',
  'applied',
  'interviewing',
  'offer',
  'rejected',
] as const;

export const REFERRAL_STATUSES = ['not_asked', 'asked', 'referred'] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  wishlist: 'Wishlist',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
};

export const REFERRAL_LABELS: Record<ReferralStatus, string> = {
  not_asked: 'Not asked',
  asked: 'Asked',
  referred: 'Referred',
};

/** Applications in these stages no longer need follow-ups. */
export const CLOSED_STATUSES: readonly ApplicationStatus[] = ['offer', 'rejected'];

export const SORT_FIELDS = [
  'company',
  'role',
  'status',
  'appliedDate',
  'followUpDate',
  'createdAt',
  'updatedAt',
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const LIMITS = {
  company: 120,
  role: 160,
  link: 2048,
  notes: 5000,
  referralName: 120,
  search: 100,
} as const;
