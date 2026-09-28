import type { CookieOptions, Request } from 'express';

export const SESSION_COOKIE = 'jt_session';

/** Minimal Cookie header parser (avoids a dependency for one cookie). */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function sessionCookieOptions(secure: boolean, expires?: Date): CookieOptions {
  return {
    httpOnly: true, // not readable from JavaScript, so XSS can't steal it
    secure, // HTTPS only in production
    sameSite: 'lax', // not sent on cross-site POSTs (CSRF defence, together with the header check)
    path: '/',
    expires,
  };
}
