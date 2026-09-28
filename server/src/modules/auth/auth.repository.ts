import type { AuthUser } from '@job-tracker/shared';
import type { Db } from '../../db/pool.js';

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  password_hash: string | null;
  is_demo: boolean;
  expires_at: Date | null;
}

export interface UserWithHash extends AuthUser {
  passwordHash: string | null;
}

function toUser(row: UserRow): UserWithHash {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isDemo: row.is_demo,
    expiresAt: row.expires_at?.toISOString() ?? null,
    passwordHash: row.password_hash,
  };
}

/** Postgres unique_violation, raised when an email is already registered. */
export const UNIQUE_VIOLATION = '23505';

/** Users and sessions. All SQL for authentication lives here. */
export class AuthRepository {
  constructor(private readonly db: Db) {}

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<UserWithHash> {
    const { rows } = await this.db.query<UserRow>(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *`,
      [input.name, input.email, input.passwordHash],
    );
    return toUser(rows[0]!);
  }

  async createDemoUser(expiresAt: Date): Promise<UserWithHash> {
    const { rows } = await this.db.query<UserRow>(
      `INSERT INTO users (name, is_demo, expires_at) VALUES ('Demo User', true, $1) RETURNING *`,
      [expiresAt],
    );
    return toUser(rows[0]!);
  }

  async findUserByEmail(email: string): Promise<UserWithHash | null> {
    const { rows } = await this.db.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async createSession(tokenHash: string, userId: string, expiresAt: Date): Promise<void> {
    await this.db.query(
      'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [tokenHash, userId, expiresAt],
    );
  }

  /** Resolve a session to its user in one query, ignoring anything expired. */
  async findUserBySession(tokenHash: string): Promise<UserWithHash | null> {
    const { rows } = await this.db.query<UserRow>(
      `SELECT u.*
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1
          AND s.expires_at > now()
          AND (u.expires_at IS NULL OR u.expires_at > now())`,
      [tokenHash],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  /**
   * Remove expired sessions and expired demo users. Demo users cascade-delete their
   * applications and sessions via foreign keys. Returns counts for logging.
   */
  async purgeExpired(): Promise<{ sessions: number; demoUsers: number }> {
    const demo = await this.db.query('DELETE FROM users WHERE is_demo AND expires_at <= now()');
    const sessions = await this.db.query('DELETE FROM sessions WHERE expires_at <= now()');
    return { sessions: sessions.rowCount ?? 0, demoUsers: demo.rowCount ?? 0 };
  }
}
