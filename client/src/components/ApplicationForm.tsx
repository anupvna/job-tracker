import { zodResolver } from '@hookform/resolvers/zod';
import {
  APPLICATION_STATUSES,
  LIMITS,
  REFERRAL_LABELS,
  REFERRAL_STATUSES,
  STATUS_LABELS,
  POSTING_SOURCE_LABELS,
  createApplicationSchema,
  parsePostingUrl,
  type Application,
  type CreateApplication,
  type CreateApplicationInput,
} from '@job-tracker/shared';
import { LoaderCircle, Trash2, WandSparkles, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { postingsApi } from '../api/postings';
import { Controller, useForm, type Path } from 'react-hook-form';
import { ApiError } from '../api/http';
import { cn } from '../lib/cn';
import { addDays, todayISO } from '../lib/dates';
import { STATUS_STYLES } from '../lib/status';
import { Button, IconButton } from './ui/Button';
import { Field } from './ui/Field';

interface Props {
  initial?: Application;
  onSubmit: (values: CreateApplication) => Promise<unknown>;
  onCancel: () => void;
  onDelete?: () => void;
  /** Extra content shown at the end of the form body (e.g. the saved job posting). */
  extra?: ReactNode;
}

/** Form values mirror the API input; empty strings are normalized to null by the shared schema. */
function toFormValues(app?: Application): CreateApplicationInput {
  return {
    company: app?.company ?? '',
    role: app?.role ?? '',
    link: app?.link ?? '',
    status: app?.status ?? 'applied',
    appliedDate: app?.appliedDate ?? (app ? '' : todayISO()),
    followUpDate: app?.followUpDate ?? '',
    notes: app?.notes ?? '',
    referralName: app?.referralName ?? '',
    referralStatus: app?.referralStatus ?? 'not_asked',
  };
}

const FOLLOW_UP_PRESETS = [
  { label: '+3 days', days: 3 },
  { label: '+1 week', days: 7 },
  { label: '+2 weeks', days: 14 },
];

export function ApplicationForm({ initial, onSubmit, onCancel, onDelete, extra }: Props) {
  const isEdit = Boolean(initial);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateApplicationInput, unknown, CreateApplication>({
    // Same schema the API validates with — one definition, two runtimes.
    resolver: zodResolver(createApplicationSchema),
    defaultValues: toFormValues(initial),
  });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (err) {
      // Surface server-side field errors inline; anything else is toasted by the caller.
      if (err instanceof ApiError && err.details?.length) {
        for (const d of err.details) {
          setError(d.path as Path<CreateApplicationInput>, { message: d.message });
        }
      }
    }
  });

  // "Autofill from link" for Greenhouse / Lever / Ashby postings.
  const linkValue = watch('link');
  const postingRef = parsePostingUrl(typeof linkValue === 'string' ? linkValue : null);
  const [autofilling, setAutofilling] = useState(false);

  async function autofill() {
    if (!postingRef || typeof linkValue !== 'string') return;
    setAutofilling(true);
    try {
      const result = await postingsApi.lookup(linkValue);
      if (!result.supported) return;
      if (result.status === 'closed') {
        toast.warning('That posting looks closed or the link is wrong — it isn’t on the job board.');
        return;
      }
      const { posting } = result;
      setValue('company', posting.company, { shouldDirty: true, shouldValidate: true });
      setValue('role', posting.title.slice(0, LIMITS.role), { shouldDirty: true, shouldValidate: true });
      toast.success(
        `Filled from ${POSTING_SOURCE_LABELS[posting.source]}${posting.location ? ` · ${posting.location}` : ''}. A copy of the description is saved when you save.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read that posting');
    } finally {
      setAutofilling(false);
    }
  }

  // ⌘/Ctrl + Enter saves from anywhere in the form.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void submit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit]);

  const notesLength = watch('notes')?.length ?? 0;
  const errorProps = (name: keyof CreateApplicationInput) => ({
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form onSubmit={submit} className="flex h-full flex-col" noValidate>
      {/* Header */}
      <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
        <div>
          <h2 id="application-form-title" className="text-lg font-semibold tracking-tight">
            {isEdit ? 'Edit application' : 'New application'}
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            {isEdit
              ? `${initial!.company} · ${initial!.role}`
              : 'Track a role you’re interested in or have applied to.'}
          </p>
        </div>
        <IconButton aria-label="Close" onClick={onCancel}>
          <X className="size-5" />
        </IconButton>
      </header>

      {/* Body */}
      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
        <Section title="Role">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company" htmlFor="company" error={errors.company?.message} required>
              <input
                id="company"
                className="input"
                autoFocus
                autoComplete="off"
                placeholder="e.g. Stripe"
                maxLength={LIMITS.company}
                {...register('company')}
                {...errorProps('company')}
              />
            </Field>
            <Field label="Role" htmlFor="role" error={errors.role?.message} required>
              <input
                id="role"
                className="input"
                autoComplete="off"
                placeholder="Software Engineer, New Grad"
                maxLength={LIMITS.role}
                {...register('role')}
                {...errorProps('role')}
              />
            </Field>
          </div>
          <Field label="Job posting link" htmlFor="link" error={errors.link?.message}>
            <input
              id="link"
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://…"
              {...register('link')}
              {...errorProps('link')}
            />
            {postingRef && (
              <Button size="sm" className="mt-1.5" onClick={autofill} disabled={autofilling}>
                {autofilling ? (
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <WandSparkles className="size-3.5" aria-hidden />
                )}
                Autofill from {POSTING_SOURCE_LABELS[postingRef.source]}
              </Button>
            )}
          </Field>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-medium text-zinc-700">Status</legend>
                <div className="flex flex-wrap gap-1.5">
                  {APPLICATION_STATUSES.map((s) => {
                    const selected = field.value === s;
                    return (
                      <label
                        key={s}
                        className={cn(
                          'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 ring-inset transition-all has-focus-visible:ring-2 has-focus-visible:ring-zinc-900',
                          selected
                            ? STATUS_STYLES[s].badge
                            : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50',
                          selected && 'shadow-sm',
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={field.name}
                          value={s}
                          checked={selected}
                          onChange={() => field.onChange(s)}
                        />
                        <span
                          className={cn(
                            'size-2 rounded-full',
                            STATUS_STYLES[s].dot,
                            !selected && 'opacity-50',
                          )}
                        />
                        {STATUS_LABELS[s]}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
          />
          <Field
            label="Applied on"
            htmlFor="appliedDate"
            error={errors.appliedDate?.message}
            className="sm:w-1/2 sm:pr-2"
          >
            <input
              id="appliedDate"
              type="date"
              className="input"
              {...register('appliedDate')}
              {...errorProps('appliedDate')}
            />
          </Field>
        </Section>

        <Section
          title="Follow-up"
          description="Overdue follow-ups are highlighted on the dashboard."
        >
          <div className="flex flex-wrap items-end gap-2">
            <Field
              label="Follow up on"
              htmlFor="followUpDate"
              error={errors.followUpDate?.message}
              className="w-full sm:w-auto sm:min-w-52"
            >
              <input
                id="followUpDate"
                type="date"
                className="input"
                {...register('followUpDate')}
                {...errorProps('followUpDate')}
              />
            </Field>
            {FOLLOW_UP_PRESETS.map((p) => (
              <Button
                key={p.days}
                size="sm"
                className="mb-0.5"
                onClick={() =>
                  setValue('followUpDate', addDays(todayISO(), p.days), { shouldDirty: true })
                }
              >
                {p.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="mb-0.5"
              onClick={() => setValue('followUpDate', '', { shouldDirty: true })}
            >
              Clear
            </Button>
          </div>
        </Section>

        <Section title="Referral">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name" htmlFor="referralName" error={errors.referralName?.message}>
              <input
                id="referralName"
                className="input"
                autoComplete="off"
                placeholder="Who could refer you?"
                {...register('referralName')}
                {...errorProps('referralName')}
              />
            </Field>
            <Controller
              control={control}
              name="referralStatus"
              render={({ field }) => (
                <fieldset>
                  <legend className="mb-1.5 text-[13px] font-medium text-zinc-700">
                    Referral status
                  </legend>
                  <div className="grid grid-cols-3 rounded-lg bg-zinc-100 p-0.5">
                    {REFERRAL_STATUSES.map((s) => (
                      <label
                        key={s}
                        className={cn(
                          'cursor-pointer rounded-md py-1.5 text-center text-[13px] font-medium transition-all has-focus-visible:ring-2 has-focus-visible:ring-zinc-900',
                          field.value === s
                            ? 'bg-white text-zinc-900 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-800',
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={field.name}
                          value={s}
                          checked={field.value === s}
                          onChange={() => field.onChange(s)}
                        />
                        {REFERRAL_LABELS[s]}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            />
          </div>
        </Section>

        <Section title="Notes">
          <Field
            label="Interview notes & prep"
            htmlFor="notes"
            error={errors.notes?.message}
            hint={`${notesLength.toLocaleString()} / ${LIMITS.notes.toLocaleString()}`}
          >
            <textarea
              id="notes"
              rows={5}
              className="input resize-y leading-relaxed"
              placeholder="Interview rounds, recruiter name, prep topics…"
              maxLength={LIMITS.notes}
              {...register('notes')}
              {...errorProps('notes')}
            />
          </Field>
        </Section>

        {extra}
      </div>

      {/* Footer */}
      <footer className="flex items-center gap-2 border-t border-zinc-200 bg-zinc-50/80 px-6 py-4">
        {onDelete && (
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={onDelete}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {isEdit ? 'Save changes' : 'Add application'}
            <kbd className="kbd ml-1 hidden sm:inline-flex">⌘↵</kbd>
          </Button>
        </div>
      </footer>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}
