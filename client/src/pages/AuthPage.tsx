import { zodResolver } from '@hookform/resolvers/zod';
import {
  loginSchema,
  signupFormSchema,
  type LoginInput,
  type SignupFormInput,
} from '@job-tracker/shared';
import { ArrowRight, BellRing, LoaderCircle, Lock, Sparkles, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError } from '../api/http';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { PasswordInput } from '../components/ui/PasswordInput';
import { useLogin, useSignup, useStartDemo } from '../hooks/useAuth';
import { cn } from '../lib/cn';

type Mode = 'login' | 'signup';

/** Map server-side validation errors onto form fields; otherwise toast. */
function handleError<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>) {
  if (err instanceof ApiError && err.details?.length) {
    for (const d of err.details) setError(d.path as Path<T>, { message: d.message });
    return;
  }
  toast.error(err instanceof Error ? err.message : 'Something went wrong');
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>(() =>
    window.location.hash === '#signup' ? 'signup' : 'login',
  );
  const demo = useStartDemo();

  const switchMode = (m: Mode) => {
    setMode(m);
    window.history.replaceState(null, '', m === 'signup' ? '#signup' : window.location.pathname);
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <Pitch />

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src="/favicon.svg" alt="" className="size-8" />
            <span className="text-lg font-semibold tracking-tight">Job Tracker</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {mode === 'login'
              ? 'Sign in to your private tracker.'
              : 'Your applications stay private to you.'}
          </p>

          <div
            role="tablist"
            aria-label="Sign in or sign up"
            className="mt-6 grid grid-cols-2 rounded-lg bg-zinc-100 p-0.5"
          >
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={cn(
                  'rounded-md py-1.5 text-sm font-medium transition-all',
                  mode === m
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800',
                )}
              >
                {m === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {mode === 'login' ? <LoginForm key="login" /> : <SignupForm key="signup" />}
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-zinc-400">
            <div className="h-px flex-1 bg-zinc-200" />
            or
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          <Button
            className="h-11 w-full"
            disabled={demo.isPending}
            onClick={() => demo.mutate(undefined, { onError: (e) => toast.error(e.message) })}
          >
            {demo.isPending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4 text-amber-500" aria-hidden />
            )}
            Try the live demo — no sign-up
          </Button>
          <p className="mt-2 text-center text-xs text-zinc-500">
            You get a private sandbox with sample data, deleted after 24 hours.
          </p>
        </div>
      </main>
    </div>
  );
}

function LoginForm() {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
    } catch (err) {
      handleError(err, setError);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="input h-10"
          aria-invalid={!!errors.email || undefined}
          {...register('email')}
        />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password || undefined}
          {...register('password')}
        />
      </Field>
      <SubmitButton pending={isSubmitting}>Sign in</SubmitButton>
    </form>
  );
}

function SignupForm() {
  const signup = useSignup();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormInput>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const submit = handleSubmit(async ({ name, email, password }) => {
    try {
      // confirmPassword is only checked here in the browser; the API gets the three real fields.
      await signup.mutateAsync({ name, email, password });
      toast.success('Account created');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
        setError('email', { message: err.message });
        return;
      }
      handleError(err, setError);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Name" htmlFor="name" error={errors.name?.message}>
        <input
          id="name"
          autoComplete="name"
          className="input h-10"
          aria-invalid={!!errors.name || undefined}
          {...register('name')}
        />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="input h-10"
          aria-invalid={!!errors.email || undefined}
          {...register('email')}
        />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={errors.password?.message}
        hint="At least 8 characters."
      >
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password || undefined}
          {...register('password', { deps: ['confirmPassword'] })}
        />
      </Field>
      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        error={errors.confirmPassword?.message}
      >
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword || undefined}
          {...register('confirmPassword')}
        />
      </Field>
      <SubmitButton pending={isSubmitting}>Create account</SubmitButton>
    </form>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" variant="primary" className="h-10 w-full" disabled={pending}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
      {!pending && <ArrowRight className="size-4" aria-hidden />}
    </Button>
  );
}

/** Left-hand product panel (desktop only). */
function Pitch() {
  const features = [
    {
      icon: BellRing,
      title: 'Never miss a follow-up',
      body: 'Overdue follow-ups are flagged the moment they slip.',
    },
    {
      icon: Users,
      title: 'Track every referral',
      body: 'Know who you’ve asked and who has referred you.',
    },
    { icon: Lock, title: 'Private by default', body: 'Your pipeline is visible only to you.' },
  ];
  const stages = [
    { label: 'Applied', n: 24, dot: 'bg-blue-400' },
    { label: 'Interviewing', n: 6, dot: 'bg-violet-400' },
    { label: 'Offer', n: 2, dot: 'bg-emerald-400' },
  ];

  return (
    <aside className="relative hidden overflow-hidden bg-zinc-950 p-12 text-white lg:flex lg:flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 size-[32rem] rounded-full bg-violet-600/20 blur-3xl"
      />
      <div className="flex items-center gap-2.5">
        <img src="/favicon.svg" alt="" className="size-8 rounded-lg ring-1 ring-white/15" />
        <span className="text-lg font-semibold tracking-tight">Job Tracker</span>
      </div>

      <div className="relative my-auto max-w-md py-12">
        <h2 className="text-4xl leading-tight font-semibold tracking-tight">
          Run your job search like a pipeline.
        </h2>
        <p className="mt-4 text-zinc-400">
          Every application, referral and follow-up in one dashboard — so you always know what to do
          next.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-2">
          {stages.map((s) => (
            <div key={s.label} className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className={cn('size-1.5 rounded-full', s.dot)} />
                {s.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{s.n}</div>
            </div>
          ))}
        </div>

        <ul className="mt-10 space-y-5">
          {features.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                <Icon className="size-4 text-zinc-300" aria-hidden />
              </div>
              <div>
                <div className="text-sm font-medium">{title}</div>
                <div className="text-sm text-zinc-400">{body}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-zinc-500">React · TypeScript · Express · PostgreSQL</p>
    </aside>
  );
}
