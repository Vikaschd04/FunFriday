import { emailSchema, passwordSchema, personNameSchema } from '@funfriday/contracts';
import { requestJson, type ApiResult, type RequestOptions } from './http';
import { isSafeInternalHref } from './safe-href';

/** Auth-library success bodies are not used; only the status matters. */
const anyBody = { safeParse: (value: unknown) => ({ success: true as const, data: value }) };

export interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function firstIssue(result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}): string | undefined {
  return result.success ? undefined : result.error?.issues[0]?.message;
}

/** Client-side check with the same contract schemas the API uses; the API stays authoritative. */
export function validateSignUp(input: {
  name: string;
  email: string;
  password: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  const name = firstIssue(personNameSchema.safeParse(input.name));
  const email = firstIssue(emailSchema.safeParse(input.email));
  const password = firstIssue(passwordSchema.safeParse(input.password));
  if (name) errors.name = name;
  if (email) errors.email = email;
  if (password) errors.password = password;
  return errors;
}

export function validateSignIn(input: { email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.email.trim()) errors.email = 'Enter your email address.';
  else {
    const email = firstIssue(emailSchema.safeParse(input.email));
    if (email) errors.email = email;
  }
  if (!input.password) errors.password = 'Enter your password.';
  return errors;
}

/** `next` is honoured only for same-site paths inside the app or the invitation page (no query). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !isSafeInternalHref(next)) return '/app';
  if (next === '/invitations/accept') return next;
  if (next === '/app' || next.startsWith('/app/') || next.startsWith('/app?')) return next;
  return '/app';
}

export function signUp(
  input: { name: string; email: string; password: string },
  options?: RequestOptions,
): Promise<ApiResult<unknown>> {
  return requestJson({
    ...options,
    method: 'POST',
    path: '/auth/sign-up/email',
    body: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
    },
    schema: anyBody,
  });
}

export function signIn(
  input: { email: string; password: string },
  options?: RequestOptions,
): Promise<ApiResult<unknown>> {
  return requestJson({
    ...options,
    method: 'POST',
    path: '/auth/sign-in/email',
    body: { email: input.email.trim().toLowerCase(), password: input.password },
    schema: anyBody,
  });
}

export function signOut(options?: RequestOptions): Promise<ApiResult<unknown>> {
  return requestJson({
    ...options,
    method: 'POST',
    path: '/auth/sign-out',
    body: {},
    schema: anyBody,
  });
}

export function sendVerificationEmail(
  email: string,
  options?: RequestOptions,
): Promise<ApiResult<unknown>> {
  return requestJson({
    ...options,
    method: 'POST',
    path: '/auth/send-verification-email',
    body: { email },
    schema: anyBody,
  });
}

export function updateDisplayName(
  name: string,
  options?: RequestOptions,
): Promise<ApiResult<unknown>> {
  return requestJson({
    ...options,
    method: 'POST',
    path: '/auth/update-user',
    body: { name: name.trim() },
    schema: anyBody,
  });
}

export function revokeOtherSessions(options?: RequestOptions): Promise<ApiResult<unknown>> {
  return requestJson({
    ...options,
    method: 'POST',
    path: '/auth/revoke-other-sessions',
    body: {},
    schema: anyBody,
  });
}
