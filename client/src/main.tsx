import '@fontsource-variable/inter';
import './index.css';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { ApiError } from './api/http';
import { App } from './App';
import { meKey } from './hooks/useAuth';

/** If the session expires mid-use (or a demo sandbox is purged), drop back to the sign-in page. */
function onError(err: unknown) {
  if (err instanceof ApiError && err.status === 401) queryClient.setQueryData(meKey, null);
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        // Keep toasts above the phone tab bar.
        mobileOffset={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
      />
    </QueryClientProvider>
  </StrictMode>,
);
