#!/usr/bin/env node
/**
 * P4 realtime load smoke: one live This or That room with N real Socket.IO clients
 * against a RUNNING API (see tests/performance/README.md).
 *
 * Setup uses the real HTTP API (sign-up, org, invitations via the dev mailbox, session);
 * every virtual user sends its own X-Forwarded-For, so the API must run with TRUST_PROXY=1
 * or the per-IP auth rate limit (5 sign-ups/min/IP) will block setup.
 *
 * Env (defaults):
 *   LIVE_LOAD_BASE            http://localhost:4000   API origin (no /api/v1, no /live)
 *   LIVE_LOAD_ORIGIN          http://localhost:3000   allow-listed web Origin header
 *   LIVE_LOAD_CLIENTS         20                      total sockets (1 host + N-1 participants)
 *   LIVE_LOAD_ROUNDS          5                       game rounds (3..10)
 *   LIVE_LOAD_ACK_P95_MS      250                     p95 budget: join / host-command / answer acks
 *   LIVE_LOAD_PROPAGATION_P95_MS 500                  p95 budget: broadcast propagation
 *   LIVE_LOAD_INFORMATIONAL   0                       1 = report only, never fail on thresholds
 *                                                     (correctness failures still fail)
 *
 * Exit 0 = all correctness checks pass and p95 budgets met. Exit 1 otherwise.
 * Load generator and API share one machine and the generator's event loop timestamps
 * everything, so results include generator CPU contention (documented in the README).
 */
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { io } = createRequire(path.join(root, 'apps/api/package.json'))('socket.io-client');

const base = (process.env.LIVE_LOAD_BASE ?? 'http://localhost:4000').replace(/\/+$/, '');
const ORIGIN = process.env.LIVE_LOAD_ORIGIN ?? 'http://localhost:3000';
const CLIENTS = Number(process.env.LIVE_LOAD_CLIENTS ?? 20);
const ROUNDS = Number(process.env.LIVE_LOAD_ROUNDS ?? 5);
const ACK_BUDGET = Number(process.env.LIVE_LOAD_ACK_P95_MS ?? 250);
const PROP_BUDGET = Number(process.env.LIVE_LOAD_PROPAGATION_P95_MS ?? 500);
const INFORMATIONAL = process.env.LIVE_LOAD_INFORMATIONAL === '1';
const PASSWORD = 'load-test-passphrase-not-a-secret';
const RUN = randomUUID().slice(0, 8);

if (CLIENTS < 2 || ROUNDS < 3 || ROUNDS > 10) {
  console.error('LIVE_LOAD_CLIENTS must be >= 2 and LIVE_LOAD_ROUNDS within 3..10');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now();
const percentile = (sorted, p) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
    : NaN;

const metrics = new Map(); // name -> { values: number[], kind: 'ack'|'propagation'|'info' }
function record(name, kind, value) {
  if (!metrics.has(name)) metrics.set(name, { values: [], kind });
  metrics.get(name).values.push(value);
}
const problems = []; // correctness failures
const notes = []; // non-failing observations
const check = (ok, message) => {
  if (!ok) problems.push(message);
};

// ---------------------------------------------------------------- setup (HTTP)
let ipSeq = 0;
const nextIp = () => {
  ipSeq += 1;
  return `10.${200 + (Number.parseInt(RUN.slice(0, 2), 16) % 50)}.${Math.floor(ipSeq / 250)}.${(ipSeq % 250) + 1}`;
};

async function http(user, method, url, body) {
  const headers = {
    origin: ORIGIN,
    'x-forwarded-for': user.ip,
    'content-type': 'application/json',
  };
  if (user.cookie) headers.cookie = user.cookie;
  const res = await fetch(`${base}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  return { res, json, text };
}

async function signUp(label) {
  const user = { ip: nextIp(), email: `load-${RUN}-${label}@example.test`, name: `Load ${label}` };
  const { res, json, text } = await http(user, 'POST', '/api/v1/auth/sign-up/email', {
    name: user.name,
    email: user.email,
    password: PASSWORD,
  });
  if (res.status !== 200)
    throw new Error(`sign-up ${label} -> ${res.status} ${text.slice(0, 200)}`);
  user.cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  user.userId = json.user.id;
  return user;
}

async function mailTo(email, subjectPrefix) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { res, json } = await http({ ip: '10.199.0.1' }, 'GET', '/api/v1/dev/mailbox');
    if (res.status !== 200) throw new Error(`dev mailbox -> ${res.status} (DEV_MAILBOX_ENABLED?)`);
    const mail = json.messages.find((m) => m.to === email && m.subject.startsWith(subjectPrefix));
    if (mail) return mail;
    await sleep(100);
  }
  throw new Error(`no "${subjectPrefix}" mail for ${email} in the latest 50 dev-mailbox messages`);
}

async function verifyEmail(user) {
  const mail = await mailTo(user.email, '');
  const link = mail.links[0];
  if (!link) throw new Error('verification mail had no link');
  const u = new URL(link);
  // The mail link uses API_PUBLIC_URL; call the base we were given.
  await fetch(`${base}${u.pathname}${u.search}`, {
    redirect: 'manual',
    headers: { origin: ORIGIN },
  });
}

async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

async function setup() {
  const host = await signUp('host');
  let org = await http(host, 'POST', '/api/v1/organizations', { name: `Load ${RUN} (fictional)` });
  if (org.res.status !== 201) {
    await verifyEmail(host);
    org = await http(host, 'POST', '/api/v1/organizations', { name: `Load ${RUN} (fictional)` });
  }
  if (org.res.status !== 201) throw new Error(`create org -> ${org.res.status} ${org.text}`);
  const orgId = org.json.id;

  const participants = await inBatches(
    Array.from({ length: CLIENTS - 1 }, (_, i) => i),
    5,
    async (i) => {
      const user = await signUp(`p${i}`);
      // Sequential per user: invite, read its token while it is still among the latest 50 mails.
      const added = await http(host, 'POST', `/api/v1/organizations/${orgId}/members`, {
        email: user.email,
        role: 'participant',
      });
      if (added.res.status !== 201) throw new Error(`invite p${i} -> ${added.res.status}`);
      const mail = await mailTo(user.email, "You're invited");
      const link = /https?:\/\/\S+/.exec(mail.text)[0];
      const token = new URL(link).searchParams.get('token');
      const acc = await http(user, 'POST', '/api/v1/invitations/accept', { token });
      if (acc.res.status !== 200) throw new Error(`accept p${i} -> ${acc.res.status}`);
      user.membershipId = added.json.member.id;
      return user;
    },
  );
  const created = await http(host, 'POST', `/api/v1/organizations/${orgId}/sessions`, {
    title: `Load room ${RUN}`,
  });
  if (created.res.status !== 201)
    throw new Error(`create session -> ${created.res.status} ${created.text}`);
  return { host, participants, orgId, sessionId: created.json.id };
}

// ------------------------------------------------------------- socket clients
class Client {
  constructor(user, label) {
    this.user = user;
    this.label = label;
    this.arrivals = []; // { at, revision, state }
    this.disconnects = 0;
    this.socket = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const socket = io(`${base}/live`, {
        transports: ['websocket'],
        extraHeaders: { cookie: this.user.cookie, origin: ORIGIN, 'x-forwarded-for': this.user.ip },
        reconnection: false,
        forceNew: true,
      });
      this.socket = socket;
      socket.on('room:state', (state) =>
        this.arrivals.push({ at: now(), revision: state.revision, state }),
      );
      socket.on('disconnect', () => {
        this.disconnects += 1;
      });
      socket.once('connect', resolve);
      socket.once('connect_error', (e) => reject(new Error(`${this.label}: ${e.message}`)));
    });
  }

  /** Emits and returns { ack, ms } with ms = send -> ack callback. */
  async emit(event, payload, timeoutMs = 10_000) {
    const sentAt = now();
    const ack = await this.socket.timeout(timeoutMs).emitWithAck(event, payload);
    return { ack, ms: now() - sentAt, sentAt };
  }

  get latest() {
    return this.arrivals.at(-1)?.state;
  }

  firstArrival(predicate, afterAt = 0) {
    return this.arrivals.find((a) => a.at >= afterAt && predicate(a.state));
  }
}

async function waitUntil(label, fn, timeoutMs = 10_000) {
  const start = now();
  while (now() - start < timeoutMs) {
    const v = fn();
    if (v) return v;
    await sleep(2);
  }
  throw new Error(`timeout (${timeoutMs}ms) waiting for ${label}`);
}

const gameOf = (c) => c.latest?.view.game;

// ------------------------------------------------------------------- scenario
async function main() {
  const wall = now();
  console.log(`target        ${base}  origin ${ORIGIN}`);
  console.log(
    `clients       ${CLIENTS} sockets (1 host + ${CLIENTS - 1} participants), rounds ${ROUNDS}`,
  );
  const t0 = now();
  const { host, participants, sessionId } = await setup();
  console.log(
    `setup         ${((now() - t0) / 1000).toFixed(1)}s (HTTP: sign-ups, invitations, session)`,
  );

  const users = [host, ...participants];
  const clients = users.map((u, i) => new Client(u, i === 0 ? 'host' : `p${i - 1}`));
  const [hostClient] = clients;

  // (0) connect all (burst)
  const connectStart = now();
  await Promise.all(
    clients.map((c) => c.connect().then(() => record('connect', 'info', now() - connectStart))),
  );

  // (1) join all at once
  const joinResults = await Promise.all(
    clients.map(async (c) => {
      const r = await c.emit('session:join', { sessionId });
      record('join ack', 'ack', r.ms);
      check(r.ack.status === 'joined', `${c.label} join rejected: ${JSON.stringify(r.ack)}`);
      // Like a real client, adopt the ack state if no newer broadcast has arrived.
      if (r.ack.status === 'joined' && r.ack.state.revision > (c.latest?.revision ?? -1))
        c.arrivals.push({ at: now(), revision: r.ack.state.revision, state: r.ack.state });
      return r;
    }),
  );
  void joinResults;
  await waitUntil('lobby settled (all seated, all connected)', () =>
    clients.every((c) => {
      const p = c.latest?.view.participants;
      return p && p.length === CLIENTS && p.every((x) => x.connected);
    }),
  ).catch((e) => {
    const pr = hostClient.latest?.view.participants ?? [];
    problems.push(
      `${e.message} (host sees ${pr.length} seated, ${pr.filter((x) => x.connected).length} connected)`,
    );
  });
  await sleep(200);
  for (const c of clients) c.baseline = c.arrivals.length; // revision sequence is compared from here

  // (2) start_game
  const start = await hostClient.emit('host:command', {
    sessionId,
    clientActionId: randomUUID(),
    command: {
      type: 'start_game',
      game: 'this-or-that',
      config: { rounds: ROUNDS, roundSeconds: 60, allowAnswerChange: false, packId: 'starter' },
    },
  });
  record('start_game ack', 'ack', start.ms);
  check(start.ack.status === 'accepted', `start_game not accepted: ${JSON.stringify(start.ack)}`);
  await Promise.all(
    clients.map((c) =>
      waitUntil(`${c.label} question view`, () =>
        c.firstArrival((s) => s.view.game?.phase === 'question', start.sentAt),
      ),
    ),
  ).catch((e) => problems.push(e.message));
  const startArrivals = clients.map((c) =>
    c.firstArrival((s) => s.view.game?.phase === 'question', start.sentAt),
  );
  for (const a of startArrivals)
    if (a) record('start_game -> question view (per client)', 'propagation', a.at - start.sentAt);
  if (startArrivals.every(Boolean))
    record(
      'start_game -> ALL clients have question',
      'propagation',
      Math.max(...startArrivals.map((a) => a.at)) - start.sentAt,
    );

  const choiceFor = (i, round) => ['A', 'B', 'pass'][(i + round) % 3];

  // (3,4) rounds
  for (let round = 1; round <= ROUNDS; round += 1) {
    const g = gameOf(hostClient);
    check(
      g?.phase === 'question' && g.round?.number === round,
      `round ${round}: host not on question ${round} (got ${g?.phase}/${g?.round?.number})`,
    );
    const roundId = g?.round?.id;
    const revBefore = hostClient.latest.revision;
    // Round 2 exercises host close_round with only half the room answered; others auto-reveal on full participation.
    const closeByHost = round === 2;
    const answerers = closeByHost ? clients.slice(0, Math.ceil(CLIENTS / 2)) : clients;

    const sends = await Promise.all(
      answerers.map(async (c) => {
        const idx = clients.indexOf(c);
        const r = await c.emit('game:action', {
          sessionId,
          clientActionId: randomUUID(),
          action: { type: 'answer', roundId, choice: choiceFor(idx, round) },
        });
        record('answer ack (simultaneous)', 'ack', r.ms);
        check(
          r.ack.status === 'accepted',
          `round ${round} ${c.label} answer: ${JSON.stringify(r.ack)}`,
        );
        return r;
      }),
    );
    let lastSend = Math.max(...sends.map((s) => s.sentAt));
    const accepted = sends.filter((s) => s.ack.status === 'accepted').length;

    if (closeByHost) {
      // Let the answer broadcasts drain, then the host closes.
      await sleep(150);
      const close = await hostClient.emit('host:command', {
        sessionId,
        clientActionId: randomUUID(),
        command: { type: 'close_round' },
      });
      record('close_round ack', 'ack', close.ms);
      check(close.ack.status === 'accepted', `close_round: ${JSON.stringify(close.ack)}`);
      lastSend = close.sentAt;
    }

    const isReveal = (s) => s.view.game?.phase === 'reveal' && s.view.game.round?.number === round;
    await Promise.all(
      clients.map((c) =>
        waitUntil(`round ${round} ${c.label} reveal`, () => c.firstArrival(isReveal, 0)),
      ),
    ).catch((e) => problems.push(e.message));
    const reveals = clients.map((c) => c.firstArrival(isReveal));
    const label = closeByHost ? 'close_round -> reveal' : 'last answer sent -> reveal';
    for (const a of reveals) if (a) record(`${label} (per client)`, 'propagation', a.at - lastSend);
    if (reveals.every(Boolean))
      record(
        `${label} (ALL clients)`,
        'propagation',
        Math.max(...reveals.map((a) => a.at)) - lastSend,
      );

    // correctness: exact counts and answeredCount, per-client private choice
    const expected = { a: 0, b: 0, pass: 0 };
    answerers.forEach((c) => {
      const ch = choiceFor(clients.indexOf(c), round);
      expected[ch === 'A' ? 'a' : ch === 'B' ? 'b' : 'pass'] += 1;
    });
    const hostReveal = reveals[0]?.state.view.game;
    check(
      JSON.stringify(hostReveal?.reveal) === JSON.stringify(expected),
      `round ${round}: reveal ${JSON.stringify(hostReveal?.reveal)} != expected ${JSON.stringify(expected)}`,
    );
    check(
      hostReveal?.answeredCount === accepted,
      `round ${round}: answeredCount ${hostReveal?.answeredCount} != accepted ${accepted}`,
    );
    clients.forEach((c, i) => {
      const gv = reveals[i]?.state.view.game;
      if (JSON.stringify(gv?.reveal) !== JSON.stringify(expected))
        problems.push(`round ${round}: ${c.label} saw reveal ${JSON.stringify(gv?.reveal)}`);
      const answered = answerers.includes(c);
      const want = answered ? choiceFor(i, round) : null;
      if ((gv?.myChoice ?? null) !== want)
        problems.push(`round ${round}: ${c.label} myChoice ${gv?.myChoice} != ${want}`);
    });
    // each accepted answer must advance the revision exactly once, plus the reveal transition(s)
    const revAfter = hostClient.latest.revision;
    notes.push(
      `round ${round}: revisions ${revBefore} -> ${revAfter} (+${revAfter - revBefore}) for ${accepted} answers${closeByHost ? ' + close_round' : ''}`,
    );

    // next
    if (round < ROUNDS) {
      const next = await hostClient.emit('host:command', {
        sessionId,
        clientActionId: randomUUID(),
        command: { type: 'next_round' },
      });
      record('next_round ack', 'ack', next.ms);
      check(next.ack.status === 'accepted', `next_round ${round}: ${JSON.stringify(next.ack)}`);
      const isNext = (s) =>
        s.view.game?.phase === 'question' && s.view.game.round?.number === round + 1;
      await Promise.all(
        clients.map((c) =>
          waitUntil(`round ${round + 1} ${c.label} question`, () =>
            c.firstArrival(isNext, next.sentAt),
          ),
        ),
      ).catch((e) => problems.push(e.message));
      const arr = clients.map((c) => c.firstArrival(isNext, next.sentAt));
      for (const a of arr)
        if (a)
          record('next_round -> question view (per client)', 'propagation', a.at - next.sentAt);
      if (arr.every(Boolean))
        record(
          'next_round -> ALL clients have question',
          'propagation',
          Math.max(...arr.map((a) => a.at)) - next.sentAt,
        );
    }
  }

  // finish
  const endGame = await hostClient.emit('host:command', {
    sessionId,
    clientActionId: randomUUID(),
    command: { type: 'end_game' },
  });
  record('end_game ack', 'ack', endGame.ms);
  check(endGame.ack.status === 'accepted', `end_game: ${JSON.stringify(endGame.ack)}`);
  const endSession = await hostClient.emit('host:command', {
    sessionId,
    clientActionId: randomUUID(),
    command: { type: 'end_session' },
  });
  record('end_session ack', 'ack', endSession.ms);
  check(endSession.ack.status === 'accepted', `end_session: ${JSON.stringify(endSession.ack)}`);
  await Promise.all(
    clients.map((c) => waitUntil(`${c.label} ended`, () => c.latest?.view.status === 'ended')),
  ).catch((e) => problems.push(e.message));
  await sleep(300);

  // (5) revision / ordering correctness
  const finalRevs = new Set(clients.map((c) => c.latest?.revision));
  check(finalRevs.size === 1, `clients ended on different revisions: ${[...finalRevs].join(',')}`);
  const refSeq = hostClient.arrivals.slice(hostClient.baseline).map((a) => a.revision);
  let gaps = 0;
  let nonMonotonic = 0;
  clients.forEach((c) => {
    const seq = c.arrivals.slice(c.baseline).map((a) => a.revision);
    for (let i = 1; i < seq.length; i += 1) {
      if (seq[i] <= seq[i - 1]) nonMonotonic += 1;
      else if (seq[i] !== seq[i - 1] + 1) gaps += seq[i] - seq[i - 1] - 1;
    }
    if (seq.length !== refSeq.length || seq.some((r, i) => r !== refSeq[i]))
      problems.push(
        `${c.label}: revision sequence differs from host (${seq.length} vs ${refSeq.length} broadcasts)`,
      );
    if (c.disconnects > 0) problems.push(`${c.label}: unexpected disconnect`);
  });
  check(nonMonotonic === 0, `${nonMonotonic} non-monotonic/duplicate revisions delivered`);
  if (gaps > 0)
    notes.push(
      `revision gaps observed: ${gaps} skipped revision number(s) across clients (host sequence length ${refSeq.length})`,
    );
  const lastSummary = hostClient.latest?.view.lastSummary?.summary;
  check(
    lastSummary?.rounds?.length === ROUNDS,
    `summary has ${lastSummary?.rounds?.length} rounds, expected ${ROUNDS}`,
  );
  notes.push(
    `broadcasts per client after lobby: ${refSeq.length}; final revision ${[...finalRevs][0]}; gaps=${gaps}; non-monotonic=${nonMonotonic}`,
  );

  for (const c of clients) c.socket.close();
  return now() - wall;
}

function report(wallMs) {
  const rows = [];
  let failedBudget = false;
  for (const [name, { values, kind }] of metrics) {
    const s = [...values].sort((a, b) => a - b);
    const p95 = percentile(s, 95);
    const budget = kind === 'ack' ? ACK_BUDGET : kind === 'propagation' ? PROP_BUDGET : null;
    const over = budget !== null && p95 > budget;
    if (over) failedBudget = true;
    rows.push(
      `${name.padEnd(48)} n=${String(s.length).padStart(4)}  p50 ${percentile(s, 50).toFixed(1).padStart(7)}  p95 ${p95.toFixed(1).padStart(7)}  p99 ${percentile(s, 99).toFixed(1).padStart(7)}  max ${s.at(-1).toFixed(1).padStart(7)} ms` +
        (budget === null ? '  (info)' : over ? `  OVER ${budget}` : `  ok <=${budget}`),
    );
  }
  console.log('\n' + rows.join('\n'));
  console.log('');
  for (const n of notes) console.log(`note          ${n}`);
  console.log(`wall          ${(wallMs / 1000).toFixed(1)}s`);
  const thresholdFail = failedBudget && !INFORMATIONAL;
  if (INFORMATIONAL && failedBudget)
    console.log('thresholds    exceeded but LIVE_LOAD_INFORMATIONAL=1');
  if (problems.length) {
    console.log(`\nCORRECTNESS FAILURES (${problems.length}):`);
    for (const p of problems.slice(0, 30)) console.log(`  - ${p}`);
  }
  const ok = problems.length === 0 && !thresholdFail;
  console.log(
    `\n${ok ? 'PASS' : 'FAIL'}  (correctness ${problems.length ? 'FAIL' : 'ok'}, p95 budgets ${failedBudget ? (INFORMATIONAL ? 'exceeded/informational' : 'EXCEEDED') : 'met'})`,
  );
  process.exit(ok ? 0 : 1);
}

try {
  report(await main());
} catch (error) {
  console.error(`FAIL  ${error instanceof Error ? error.stack : error}`);
  if (metrics.size) report(0);
  process.exit(1);
}
