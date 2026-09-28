import { z } from 'zod';

export const AUTH_LIMITS = {
  email: 254,
  name: 80,
  passwordMin: 8,
  // scrypt has no input limit, but capping it avoids CPU-heavy hashing of huge strings.
  passwordMax: 128,
} as const;

/** How long a demo sandbox lives before it (and its data) is deleted. */
export const DEMO_TTL_HOURS = 24;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(AUTH_LIMITS.email)
  .pipe(z.email({ message: 'Enter a valid email address' }));

/** POST /api/auth/signup */
export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(AUTH_LIMITS.name, `Must be ${AUTH_LIMITS.name} characters or fewer`),
  email,
  password: z
    .string()
    .min(AUTH_LIMITS.passwordMin, `Use at least ${AUTH_LIMITS.passwordMin} characters`)
    .max(AUTH_LIMITS.passwordMax, `Must be ${AUTH_LIMITS.passwordMax} characters or fewer`),
});

/** POST /api/auth/login — deliberately loose so we never hint at which part was wrong. */
export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(AUTH_LIMITS.passwordMax),
});

export type SignupInput = z.input<typeof signupSchema>;
export type LoginInput = z.input<typeof loginSchema>;

/** The signed-in user, as returned by GET /api/auth/me. */
export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  isDemo: boolean;
  /** ISO timestamp when a demo sandbox will be deleted; null for real accounts. */
  expiresAt: string | null;
}
