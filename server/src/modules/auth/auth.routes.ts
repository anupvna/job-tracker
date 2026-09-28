import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema, signupSchema } from '@job-tracker/shared';
import { readCookie, SESSION_COOKIE, sessionCookieOptions } from '../../lib/cookies.js';
import { requireAuth, currentUser } from '../../middleware/auth.js';
import { parseOrThrow } from '../../middleware/validate.js';
import type { AuthService, Session } from './auth.service.js';

interface Options {
  secureCookies: boolean;
  /** Strict per-IP limit on credential endpoints to slow down password guessing. */
  rateLimit: boolean;
}

/** REST routes for /api/auth. */
export function authRouter(auth: AuthService, opts: Options): Router {
  const router = Router();

  const setSession = (res: Response, session: Session) =>
    res.cookie(
      SESSION_COOKIE,
      session.token,
      sessionCookieOptions(opts.secureCookies, session.expiresAt),
    );

  const credentialLimiter = opts.rateLimit
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 20,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
      })
    : (_req: unknown, _res: unknown, next: () => void) => next();

  const demoLimiter = opts.rateLimit
    ? rateLimit({
        windowMs: 60 * 60 * 1000,
        limit: 10,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
      })
    : (_req: unknown, _res: unknown, next: () => void) => next();

  router.post('/signup', credentialLimiter, async (req, res) => {
    const input = parseOrThrow(signupSchema, req.body);
    const session = await auth.signup(input);
    setSession(res, session).status(201).json(session.user);
  });

  router.post('/login', credentialLimiter, async (req, res) => {
    const input = parseOrThrow(loginSchema, req.body);
    const session = await auth.login(input);
    setSession(res, session).json(session.user);
  });

  router.post('/demo', demoLimiter, async (_req, res) => {
    const session = await auth.startDemo();
    setSession(res, session).status(201).json(session.user);
  });

  router.post('/logout', async (req, res) => {
    await auth.logout(readCookie(req, SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(opts.secureCookies)).status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json(currentUser(req));
  });

  return router;
}
