import type { AuthUser } from '@job-tracker/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';

export const meKey = ['auth', 'me'] as const;

export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: authApi.me, retry: false, staleTime: Infinity });
}

/** Switch the whole app to a new identity, dropping any cached data from the previous one. */
function becomeUser(qc: QueryClient, user: AuthUser | null) {
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== meKey[0] });
  qc.setQueryData(meKey, user);
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: authApi.login, onSuccess: (user) => becomeUser(qc, user) });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: authApi.signup, onSuccess: (user) => becomeUser(qc, user) });
}

export function useStartDemo() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: authApi.demo, onSuccess: (user) => becomeUser(qc, user) });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: authApi.logout, onSettled: () => becomeUser(qc, null) });
}
