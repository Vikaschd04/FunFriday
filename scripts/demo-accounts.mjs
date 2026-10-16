#!/usr/bin/env node
/**
 * Creates (or reuses) LOCAL demo accounts for trying FunFriday by hand, through the real API:
 * sign-up -> organisation -> invitation links from the dev mailbox -> acceptance.
 * Idempotent: re-running reuses existing accounts and memberships.
 *
 * Requirements: API running (`pnpm dev`), DEV_MAILBOX_ENABLED=true (local only).
 * All people, emails and the organisation are fictional; `.test` addresses are never deliverable.
 * Usage: pnpm demo:accounts   (env DEMO_API=http://localhost:4000, DEMO_WEB=http://localhost:3000)
 */
const API = (process.env.DEMO_API ?? 'http://localhost:4000').replace(/\/+$/, '');
const WEB = (process.env.DEMO_WEB ?? 'http://localhost:3000').replace(/\/+$/, '');
// The password below is public (this file is in a public repo): only ever create these
// accounts on a local machine.
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(API).hostname)) {
  console.error(`demo-accounts: refusing to run against ${API} - local machines only.`);
  process.exit(1);
}
const PASSWORD = 'FunFriday-Demo-2026';
const ORG_NAME = 'Acme Demo (fictional)';

const people = [
  { key: 'admin', name: 'Ava Admin', email: 'ava.admin@funfriday.test', role: 'admin' },
  { key: 'host', name: 'Hugo Host', email: 'hugo.host@funfriday.test', role: 'host' },
  { key: 'p1', name: 'Pia Player', email: 'pia.player@funfriday.test', role: 'participant' },
  { key: 'p2', name: 'Pat Player', email: 'pat.player@funfriday.test', role: 'participant' },
  { key: 'p3', name: 'Priya Player', email: 'priya.player@funfriday.test', role: 'participant' },
];

const sessions = new Map();

async function call(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      Origin: WEB,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  const session = cookies
    .map((c) => c.split(';')[0])
    .find((c) => /funfriday\.session_token=/.test(c));
  let json = null;
  try {
    json = await res.json();
  } catch {
    // redirects and 204s have no JSON body
  }
  return { status: res.status, json, session };
}

async function signInOrUp(person) {
  const up = await call('/api/v1/auth/sign-up/email', {
    method: 'POST',
    body: { name: person.name, email: person.email, password: PASSWORD },
  });
  if (up.status === 200 && up.session) return { cookie: up.session, created: true };
  const inn = await call('/api/v1/auth/sign-in/email', {
    method: 'POST',
    body: { email: person.email, password: PASSWORD },
  });
  if (inn.status === 200 && inn.session) return { cookie: inn.session, created: false };
  throw new Error(
    `Could not sign up or sign in ${person.email} (sign-up ${up.status}, sign-in ${inn.status}). ` +
      'If it says 429, wait a minute (5 attempts/min) and run again.',
  );
}

async function mailbox() {
  const res = await call('/api/v1/dev/mailbox');
  if (res.status !== 200) {
    throw new Error(
      'Dev mailbox unavailable: set DEV_MAILBOX_ENABLED=true in .env and restart the API.',
    );
  }
  return res.json.messages;
}

async function latestLink(to, pattern) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const message = (await mailbox()).find(
      (m) => m.to === to && m.links.some((l) => pattern.test(l)),
    );
    if (message) return message.links.find((l) => pattern.test(l));
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

async function main() {
  const health = await fetch(`${API}/api/v1/health/ready`).catch(() => null);
  if (!health?.ok) throw new Error(`API not ready at ${API} - start it with \`pnpm dev\` first.`);

  for (const person of people) {
    const { cookie, created } = await signInOrUp(person);
    sessions.set(person.key, cookie);
    console.log(`${created ? 'created ' : 'reused  '} ${person.email}`);
  }

  // Admin: verify email (so no "verify your email" notice) and ensure the demo organisation exists.
  const adminCookie = sessions.get('admin');
  const verify = await latestLink('ava.admin@funfriday.test', /\/auth\/verify-email\?token=/);
  if (verify) await fetch(verify, { redirect: 'manual' });
  let me = (await call('/api/v1/me', { cookie: adminCookie })).json;
  let org = me.memberships.find((m) => m.organization.name === ORG_NAME)?.organization;
  if (!org) {
    org = (
      await call('/api/v1/organizations', {
        method: 'POST',
        body: { name: ORG_NAME },
        cookie: adminCookie,
      })
    ).json;
    console.log(`created  organisation "${ORG_NAME}"`);
  } else {
    console.log(`reused   organisation "${ORG_NAME}"`);
  }

  // Everyone else: invite with their role, then accept the emailed link as that person.
  const members = (await call(`/api/v1/organizations/${org.id}/members`, { cookie: adminCookie }))
    .json.members;
  for (const person of people.filter((p) => p.key !== 'admin')) {
    const existing = members.find((m) => m.email === person.email);
    if (existing?.status === 'active') {
      console.log(`member   ${person.email} already active (${existing.role})`);
      continue;
    }
    if (!existing) {
      const added = await call(`/api/v1/organizations/${org.id}/members`, {
        method: 'POST',
        body: { email: person.email, role: person.role },
        cookie: adminCookie,
      });
      if (added.status !== 201) throw new Error(`Adding ${person.email} failed (${added.status})`);
    }
    const link = await latestLink(person.email, /\/invitations\/accept\?token=/);
    const token = link && new URL(link).searchParams.get('token');
    if (!token) throw new Error(`No invitation email found for ${person.email}`);
    const accepted = await call('/api/v1/invitations/accept', {
      method: 'POST',
      body: { token },
      cookie: sessions.get(person.key),
    });
    if (accepted.status !== 200)
      throw new Error(`Accepting for ${person.email} failed (${accepted.status})`);
    console.log(`joined   ${person.email} as ${person.role}`);
  }

  me = (await call('/api/v1/me', { cookie: adminCookie })).json;
  console.log(`\nDemo organisation: ${ORG_NAME}  (sign in at ${WEB}/sign-in)`);
  console.log(`Password for every demo account: ${PASSWORD}\n`);
  for (const person of people)
    console.log(`  ${person.role.padEnd(12)} ${person.name.padEnd(14)} ${person.email}`);
  console.log('\nLocal, fictional test accounts only - never reuse this password anywhere real.');
}

main().catch((error) => {
  console.error(`demo-accounts: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
