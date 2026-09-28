import { createHash, randomBytes } from 'node:crypto';
import {
  DEMO_TTL_HOURS,
  type AuthUser,
  type LoginInput,
  type SignupInput,
} from '@job-tracker/shared';
import { HttpError } from '../../lib/httpError.js';
import { getDummyHash, hashPassword, verifyPassword } from '../../lib/password.js';
import { seed } from '../../db/seed.js';
import type { ApplicationsRepository } from '../applications/applications.repository.js';
import { AuthRepository, UNIQUE_VIOLATION, type UserWithHash } from './auth.repository.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEMO_TTL_MS = DEMO_TTL_HOURS * 60 * 60 * 1000;

export interface Session {
  /** Raw token for the cookie. Never stored — only its hash is. */
  token: string;
  expiresAt: Date;
  user: AuthUser;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function publicUser({ passwordHash: _omit, ...user }: UserWithHash): AuthUser {
  return user;
}

/** Sign-up, login, sessions and demo sandboxes. Knows nothing about HTTP. */
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly applications: ApplicationsRepository,
  ) {}

  async signup(input: Required<SignupInput>): Promise<Session> {
    const passwordHash = await hashPassword(input.password);
    try {
      const user = await this.repo.createUser({
        name: input.name,
        email: input.email,
        passwordHash,
      });
      return this.startSession(user);
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
      }
      throw err;
    }
  }

  async login(input: Required<LoginInput>): Promise<Session> {
    const user = await this.repo.findUserByEmail(input.email);
    // Always run a hash check, even for unknown emails, so timing doesn't reveal which emails exist.
    const ok = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !ok) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
    }
    return this.startSession(user);
  }

  /** A throwaway account pre-filled with sample data, deleted automatically after DEMO_TTL_HOURS. */
  async startDemo(): Promise<Session> {
    await this.repo.purgeExpired(); // opportunistic cleanup, so the table can't grow unbounded
    const user = await this.repo.createDemoUser(new Date(Date.now() + DEMO_TTL_MS));
    await seed(this.applications, user.id);
    return this.startSession(user, new Date(user.expiresAt!));
  }

  async userForToken(token: string | undefined): Promise<AuthUser | null> {
    if (!token) return null;
    const user = await this.repo.findUserBySession(hashToken(token));
    return user ? publicUser(user) : null;
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.repo.deleteSession(hashToken(token));
  }

  purgeExpired() {
    return this.repo.purgeExpired();
  }

  private async startSession(user: UserWithHash, cap?: Date): Promise<Session> {
    const token = randomBytes(32).toString('base64url'); // 256 bits of entropy
    let expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    if (cap && cap < expiresAt) expiresAt = cap;
    await this.repo.createSession(hashToken(token), user.id, expiresAt);
    return { token, expiresAt, user: publicUser(user) };
  }
}
