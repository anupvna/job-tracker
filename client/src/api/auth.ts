import type { AuthUser, LoginInput, SignupInput } from '@job-tracker/shared';
import { ApiError, http } from './http';

export const authApi = {
  /** The current user, or null when signed out. */
  me: async (): Promise<AuthUser | null> => {
    try {
      return await http<AuthUser>('/api/auth/me');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },
  signup: (input: SignupInput) =>
    http<AuthUser>('/api/auth/signup', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: LoginInput) =>
    http<AuthUser>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  demo: () => http<AuthUser>('/api/auth/demo', { method: 'POST' }),
  logout: () => http<void>('/api/auth/logout', { method: 'POST' }),
};
