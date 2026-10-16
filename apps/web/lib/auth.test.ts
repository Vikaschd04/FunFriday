import { describe, expect, it } from 'vitest';
import {
  revokeOtherSessions,
  safeNextPath,
  signIn,
  signOut,
  signUp,
  updateDisplayName,
  validateSignIn,
  validateSignUp,
} from './auth';

const base = 'http://api.test/api/v1';

function fake(status: number, body: unknown = { ok: true }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as unknown as typeof fetch;
  return { calls, opts: { fetchImpl, baseUrl: base } };
}

describe('validateSignUp', () => {
  it('accepts a valid form', () => {
    expect(
      validateSignUp({ name: 'Ana', email: 'ana@example.test', password: 'correct horse battery' }),
    ).toEqual({});
  });
  it('reports each field with contract copy', () => {
    const errors = validateSignUp({ name: ' ', email: 'nope', password: 'short' });
    expect(errors.name).toBe('Enter your name.');
    expect(errors.email).toBe('Enter a valid email address.');
    expect(errors.password).toBe('Use at least 12 characters.');
  });
  it('rejects over-long passwords', () => {
    expect(
      validateSignUp({ name: 'A', email: 'a@example.test', password: 'x'.repeat(129) }).password,
    ).toBe('Use at most 128 characters.');
  });
});

describe('validateSignIn', () => {
  it('asks for both fields without leaking policy', () => {
    expect(validateSignIn({ email: '', password: '' })).toEqual({
      email: 'Enter your email address.',
      password: 'Enter your password.',
    });
    expect(validateSignIn({ email: 'a@example.test', password: 'x' })).toEqual({});
  });
});

describe('safeNextPath', () => {
  it('allows app paths only', () => {
    expect(safeNextPath('/app/settings/members?org=1')).toBe('/app/settings/members?org=1');
    expect(safeNextPath('/app')).toBe('/app');
    expect(safeNextPath('/invitations/accept')).toBe('/invitations/accept');
  });
  it.each([
    null,
    undefined,
    '',
    '//evil.test',
    '/\\evil',
    'https://evil.test',
    '/sign-in',
    '/appx',
    'javascript:1',
  ])('falls back to /app for %s', (value) => {
    expect(safeNextPath(value)).toBe('/app');
  });
});

describe('auth calls', () => {
  it('signs up with a trimmed, lower-cased email and credentials', async () => {
    const { calls, opts } = fake(200);
    await signUp(
      { name: ' Ana ', email: ' Ana@Example.TEST ', password: 'correct horse battery' },
      opts,
    );
    expect(calls[0]?.url).toBe(`${base}/auth/sign-up/email`);
    expect(calls[0]?.init.credentials).toBe('include');
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({
      name: 'Ana',
      email: 'ana@example.test',
      password: 'correct horse battery',
    });
  });

  it('maps library errors without relying on the envelope', async () => {
    expect(
      (
        await signIn(
          { email: 'a@example.test', password: 'x' },
          fake(401, { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'm' }).opts,
        )
      ).kind,
    ).toBe('unauthenticated');
    expect(
      (
        await signIn(
          { email: 'a@example.test', password: 'x' },
          fake(429, { message: 'Too many requests' }).opts,
        )
      ).kind,
    ).toBe('rate_limited');
    expect(
      (
        await signUp(
          { name: 'A', email: 'a@example.test', password: 'x'.repeat(12) },
          fake(422, { code: 'USER_ALREADY_EXISTS', message: 'm' }).opts,
        )
      ).kind,
    ).toBe('invalid');
  });

  it('posts to sign-out, update-user and revoke-other-sessions', async () => {
    const { calls, opts } = fake(200);
    await signOut(opts);
    await updateDisplayName(' New ', opts);
    await revokeOtherSessions(opts);
    expect(calls.map((c) => c.url)).toEqual([
      `${base}/auth/sign-out`,
      `${base}/auth/update-user`,
      `${base}/auth/revoke-other-sessions`,
    ]);
    expect(JSON.parse(calls[1]?.init.body as string)).toEqual({ name: 'New' });
  });
});
