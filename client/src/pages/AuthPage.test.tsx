import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from './AuthPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('AuthPage', () => {
  it('validates the sign-up form with the shared schema before calling the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Sign up' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('starts a demo with the CSRF header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ id: '1', name: 'Demo User', email: null, isDemo: true, expiresAt: null }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /try the live demo/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/auth/demo');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['X-Requested-With']).toBe('fetch');
  });
});
