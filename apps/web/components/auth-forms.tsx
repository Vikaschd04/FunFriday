'use client';

import Link from 'next/link';
import { type FormEvent, type ReactNode, type Ref, useEffect, useRef, useState } from 'react';
import { PASSWORD_POLICY } from '@funfriday/contracts';
import { Button, Card, Notice, TextField } from '@funfriday/ui';
import { hardNavigate } from '@/lib/navigate';
import { useHydrated } from '@/lib/use-hydrated';
import {
  safeNextPath,
  signIn,
  signUp,
  validateSignIn,
  validateSignUp,
  type FieldErrors,
} from '@/lib/auth';

function PasswordField({
  label,
  error,
  hint,
  autoComplete,
}: {
  label: string;
  error?: string;
  hint?: string;
  autoComplete: 'current-password' | 'new-password';
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <TextField
        label={label}
        name="password"
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        hint={hint}
        error={error}
      />
      <div>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={shown}
          onClick={() => {
            setShown((v) => !v);
          }}
        >
          Show password
        </Button>
      </div>
    </div>
  );
}

/** Failure notice that takes focus when it appears, so keyboard users land on it. */
function FormError({ title, children }: { title: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus();
  }, [children]);
  return (
    <div ref={box} tabIndex={-1} className="rounded-ff-button outline-offset-2">
      <Notice tone="danger" announce title={title}>
        {children}
      </Notice>
    </div>
  );
}

/**
 * Inputs are uncontrolled and read at submit time, so anything typed before hydration is
 * kept. Until hydration the submit button sits in a disabled fieldset: the browser's own
 * submission (which would put credentials in the URL) can't run before our handler exists.
 */
function readField(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === 'string' ? value : '';
}

function SubmitGate({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  return (
    <fieldset disabled={!hydrated} role="presentation" className="m-0 min-w-0 border-0 p-0">
      {children}
    </fieldset>
  );
}

function focusFirstInvalid(form: HTMLFormElement | null): void {
  // Wait for React to render aria-invalid before looking for the field.
  requestAnimationFrame(() => {
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}

function AuthCard({
  title,
  intro,
  headingRef,
  children,
}: {
  title: string;
  intro: string;
  headingRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md pt-8 md:pt-12">
      <Card className="gap-5 p-6 md:p-8">
        <header>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-heading text-[30px] leading-9 font-extrabold tracking-tight text-ff-ink outline-none"
          >
            {title}
          </h1>
          <p className="mt-1 text-ff-muted">{intro}</p>
        </header>
        {children}
      </Card>
    </div>
  );
}

export function SignInForm({ next, signedOut }: { next?: string; signedOut: boolean }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const target = safeNextPath(next);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // The notice is already in the page at load, so move focus to the heading to announce it.
    if (signedOut) heading.current?.focus();
  }, [signedOut]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setFormError(null);
    if (!form.current) return;
    const email = readField(form.current, 'email');
    const password = readField(form.current, 'password');
    const found = validateSignIn({ email, password });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstInvalid(form.current);
      return;
    }
    setBusy(true);
    const result = await signIn({ email, password });
    if (result.kind === 'ok') {
      hardNavigate(target);
      return;
    }
    setBusy(false);
    if (result.kind === 'rate_limited') {
      setFormError('Too many attempts. Wait a minute, then try again.');
    } else if (result.kind === 'unreachable') {
      setFormError("We can't reach FunFriday. Check your connection and try again.");
    } else if (result.kind === 'server_error' || result.kind === 'invalid_response') {
      setFormError('Something went wrong on our side. Try again in a moment.');
    } else {
      setFormError('Email or password is incorrect.');
    }
  };

  const signUpHref = next ? `/sign-up?next=${encodeURIComponent(target)}` : '/sign-up';
  return (
    <AuthCard
      title="Sign in"
      intro="Welcome back. Sign in to your FunFriday workspace."
      headingRef={heading}
    >
      {signedOut && !formError && (
        <Notice tone="success" announce>
          You&apos;ve been signed out.
        </Notice>
      )}
      {formError && <FormError title="We couldn't sign you in">{formError}</FormError>}
      <form
        ref={form}
        method="post"
        noValidate
        onSubmit={(e) => void submit(e)}
        className="flex flex-col gap-4"
      >
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={errors.email}
        />
        <PasswordField label="Password" error={errors.password} autoComplete="current-password" />
        <SubmitGate>
          <Button type="submit" loading={busy} loadingLabel="Signing in..." fullWidth>
            Sign in
          </Button>
        </SubmitGate>
      </form>
      <p className="text-ff-muted">
        New to FunFriday?{' '}
        <Link
          href={signUpHref}
          className="inline-flex min-h-11 items-center font-semibold text-ff-violet-700 underline underline-offset-4"
        >
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const target = safeNextPath(next);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setFormError(null);
    if (!form.current) return;
    const name = readField(form.current, 'name');
    const email = readField(form.current, 'email');
    const password = readField(form.current, 'password');
    const found = validateSignUp({ name, email, password });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstInvalid(form.current);
      return;
    }
    setBusy(true);
    const result = await signUp({ name, email, password });
    if (result.kind === 'ok') {
      hardNavigate(target);
      return;
    }
    setBusy(false);
    if (result.kind === 'rate_limited') {
      setFormError('Too many attempts. Wait a minute, then try again.');
    } else if (result.kind === 'unreachable') {
      setFormError("We can't reach FunFriday. Check your connection and try again.");
    } else {
      // Same words whether or not the email already has an account.
      setFormError("We couldn't create that account. If you already have one, sign in instead.");
    }
  };

  const signInHref = next ? `/sign-in?next=${encodeURIComponent(target)}` : '/sign-in';
  return (
    <AuthCard title="Create your account" intro="Start planning short, friendly team sessions.">
      {formError && <FormError title="We couldn't create your account">{formError}</FormError>}
      <form
        ref={form}
        method="post"
        noValidate
        onSubmit={(e) => void submit(e)}
        className="flex flex-col gap-4"
      >
        <TextField label="Your name" name="name" autoComplete="name" required error={errors.name} />
        <TextField
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={errors.email}
        />
        <PasswordField
          label="Password"
          error={errors.password}
          hint={`Use ${PASSWORD_POLICY.minLength}-${PASSWORD_POLICY.maxLength} characters. A short phrase of unrelated words works well.`}
          autoComplete="new-password"
        />
        <SubmitGate>
          <Button type="submit" loading={busy} loadingLabel="Creating account..." fullWidth>
            Create account
          </Button>
        </SubmitGate>
      </form>
      <p className="text-ff-muted">
        Already have an account?{' '}
        <Link
          href={signInHref}
          className="inline-flex min-h-11 items-center font-semibold text-ff-violet-700 underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
