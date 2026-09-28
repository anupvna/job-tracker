import type { ApiErrorBody } from '@job-tracker/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ApiErrorBody['error']['details'] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/** Typed fetch wrapper: JSON in, JSON out, non-2xx responses become ApiError. */
export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      // Required by the API on writes; cross-site forms can't set custom headers (CSRF defence).
      'X-Requested-With': 'fetch',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'HTTP_ERROR',
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
    );
  }
  return body as T;
}

export function toQueryString(params: Record<string, string | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false) search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}
