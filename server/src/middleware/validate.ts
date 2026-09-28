import type { z } from 'zod';
import { HttpError } from '../lib/httpError.js';

/**
 * Parse `input` with a Zod schema, throwing a 400 with field-level details on failure.
 * Used by route handlers for body, params and query alike.
 */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
    throw HttpError.badRequest('Request validation failed', details);
  }
  return result.data;
}
