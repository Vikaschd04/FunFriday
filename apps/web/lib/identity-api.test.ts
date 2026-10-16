import { describe, expect, it } from 'vitest';
import {
  addMember,
  changeMemberRole,
  createOrganization,
  fetchAudit,
  fetchDevMailbox,
  fetchMe,
  fetchMembers,
  acceptInvitation,
  previewInvitation,
  removeMember,
} from './identity-api';

const ID = '3f2b8a52-0c1e-4b6e-9a53-1d7c6f1f2a10';
const ID2 = '7a1d2c33-5b94-4f0e-8d11-0c9b8e7f6a21';
const base = 'http://api.test/api/v1/';

interface Call {
  url: string;
  init: RequestInit;
}

function fake(status: number, body?: unknown) {
  const calls: Call[] = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }) as unknown as typeof fetch;
  return { calls, opts: { fetchImpl, baseUrl: base } };
}

const me = {
  user: { id: ID, name: 'Ana', email: 'ana@example.test', emailVerified: true },
  memberships: [
    { organization: { id: ID2, slug: 'acme-fictional', name: 'Acme (fictional)' }, role: 'admin' },
  ],
  needsEmailVerification: false,
};
const member = {
  id: ID,
  name: 'Sam',
  email: 'sam@example.test',
  role: 'host',
  status: 'active',
  joinedAt: '2026-01-01T00:00:00.000Z',
};

describe('requestJson via fetchMe', () => {
  it('sends credentials and parses a valid body', async () => {
    const { calls, opts } = fake(200, me);
    const result = await fetchMe(opts);
    expect(result.kind).toBe('ok');
    expect(calls[0]?.url).toBe('http://api.test/api/v1/me');
    expect(calls[0]?.init.credentials).toBe('include');
    expect(calls[0]?.init.method).toBe('GET');
  });

  it('rejects bodies that break the contract', async () => {
    expect((await fetchMe(fake(200, { user: {} }).opts)).kind).toBe('invalid_response');
    const bad = {
      fetchImpl: (() => Promise.resolve(new Response('<html>'))) as unknown as typeof fetch,
      baseUrl: base,
    };
    expect((await fetchMe(bad)).kind).toBe('invalid_response');
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [429, 'rate_limited'],
    [500, 'server_error'],
    [503, 'server_error'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    const result = await fetchMe(fake(status, { code: 'X', message: 'm', requestId: 'r' }).opts);
    expect(result.kind).toBe(kind);
  });

  it('maps network failures and timeouts to unreachable', async () => {
    const down = {
      fetchImpl: (() => Promise.reject(new TypeError('x'))) as unknown as typeof fetch,
      baseUrl: base,
    };
    expect(await fetchMe(down)).toEqual({ kind: 'unreachable' });
    const hang = {
      baseUrl: base,
      timeoutMs: 10,
      fetchImpl: ((_u: string, init: RequestInit) =>
        new Promise((_res, rej) => {
          init.signal?.addEventListener('abort', () => rej(new DOMException('a', 'AbortError')));
        })) as unknown as typeof fetch,
    };
    expect(await fetchMe(hang)).toEqual({ kind: 'unreachable' });
  });
});

describe('mutations', () => {
  it('maps 409 to conflict with the API code', async () => {
    const { opts } = fake(409, { code: 'LAST_ADMIN', message: 'Keep one admin.', requestId: 'r' });
    expect(await changeMemberRole(ID2, ID, 'host', opts)).toEqual({
      kind: 'conflict',
      code: 'LAST_ADMIN',
      message: 'Keep one admin.',
    });
  });

  it('keeps field errors from a 400 envelope', async () => {
    const { opts } = fake(400, {
      code: 'BAD_REQUEST',
      message: 'bad',
      requestId: 'r',
      details: { fieldErrors: { name: ['Use at least 2 characters.'] } },
    });
    const result = await createOrganization({ name: 'x' }, opts);
    expect(result).toMatchObject({
      kind: 'invalid',
      fieldErrors: { name: ['Use at least 2 characters.'] },
    });
  });

  it('posts JSON bodies and unwraps the member', async () => {
    const { calls, opts } = fake(201, { member });
    const result = await addMember(ID2, { email: 'sam@example.test', role: 'host' }, opts);
    expect(result.kind === 'ok' && result.data.name).toBe('Sam');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.body).toBe(JSON.stringify({ email: 'sam@example.test', role: 'host' }));
    expect(new Headers(calls[0]?.init.headers).get('content-type')).toBe('application/json');
  });

  it('treats 204 as ok without a body', async () => {
    const { calls, opts } = fake(204);
    expect((await removeMember(ID2, ID, opts)).kind).toBe('ok');
    expect(calls[0]?.init.method).toBe('DELETE');
  });
});

describe('lists', () => {
  it('encodes the audit cursor and parses entries', async () => {
    const { calls, opts } = fake(200, { entries: [], nextCursor: null });
    expect((await fetchAudit(ID2, 'a b/c', opts)).kind).toBe('ok');
    expect(calls[0]?.url).toBe(
      `http://api.test/api/v1/organizations/${ID2}/audit?cursor=a%20b%2Fc`,
    );
  });

  it('returns members with emails absent for non-admins', async () => {
    const { email: _email, ...redacted } = member;
    const result = await fetchMembers(ID2, fake(200, { members: [redacted] }).opts);
    expect(result.kind === 'ok' && result.data.members[0]?.email).toBeUndefined();
  });
});

describe('fetchDevMailbox', () => {
  it('reports a disabled mailbox as not_found', async () => {
    expect(
      (await fetchDevMailbox(fake(404, { code: 'NOT_FOUND', message: 'n', requestId: 'r' }).opts))
        .kind,
    ).toBe('not_found');
  });

  it('drops non-http links', async () => {
    const mail = {
      id: ID,
      to: 'a@example.test',
      subject: 'Verify',
      text: 't',
      links: ['http://localhost:4000/api/v1/auth/verify-email?token=1', 'ftp://x.test/a'],
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const result = await fetchDevMailbox(fake(200, { messages: [mail] }).opts);
    expect(result.kind === 'ok' && result.data.messages[0]?.links).toEqual([
      'http://localhost:4000/api/v1/auth/verify-email?token=1',
    ]);
  });
});

describe('invitations', () => {
  const token = 'A'.repeat(43);
  it('posts the token in the body, never the URL', async () => {
    const { calls, opts } = fake(200, {
      organization: { id: ID2, slug: 'acme-fictional', name: 'Acme (fictional)' },
      role: 'participant',
      emailMatches: true,
      alreadyMember: false,
    });
    const result = await previewInvitation(token, opts);
    expect(result.kind).toBe('ok');
    expect(calls[0]?.url).toBe('http://api.test/api/v1/invitations/preview');
    expect(calls[0]?.init.body).toBe(JSON.stringify({ token }));
  });

  it('maps expiry, mismatch and reuse', async () => {
    expect((await previewInvitation(token, fake(410, { code: 'INVITE_EXPIRED' }).opts)).kind).toBe(
      'gone',
    );
    expect(
      await acceptInvitation(
        token,
        fake(403, { code: 'INVITE_EMAIL_MISMATCH', message: 'm' }).opts,
      ),
    ).toMatchObject({ kind: 'forbidden', code: 'INVITE_EMAIL_MISMATCH' });
    expect((await acceptInvitation(token, fake(404, {}).opts)).kind).toBe('not_found');
    expect((await acceptInvitation(token, fake(409, { code: 'CONFLICT' }).opts)).kind).toBe(
      'conflict',
    );
  });
});
