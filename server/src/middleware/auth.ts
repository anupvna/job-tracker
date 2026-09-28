import type { Request, RequestHandler } from 'express';
import type { AuthUser } from '@job-tracker/shared';
import { readCookie, SESSION_COOKIE } from '../lib/cookies.js';
import { HttpError } from '../lib/httpError.js';
import type { AuthService } from '../modules/auth/auth.service.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/** Resolve the session cookie to a user (if any) and attach it to the request. */
export function loadUser(auth: AuthService): RequestHandler {
  return async (req, _res, next) => {
    req.user = (await auth.userForToken(readCookie(req, SESSION_COOKIE))) ?? undefined;
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in to continue');
  next();
};

/** The signed-in user. Only call behind `requireAuth`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in to continue');
  return req.user;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth (on top of SameSite=Lax cookies): state-changing requests must carry
 * a custom header. Browsers won't send custom headers cross-origin without a CORS preflight,
 * which this API doesn't grant, so a malicious site can't forge these requests.
 */
export const requireCsrfHeader: RequestHandler = (req, _res, next) => {
  if (!SAFE_METHODS.has(req.method) && req.get('x-requested-with') !== 'fetch') {
    throw new HttpError(403, 'CSRF', 'Missing X-Requested-With header');
  }
  next();
};
