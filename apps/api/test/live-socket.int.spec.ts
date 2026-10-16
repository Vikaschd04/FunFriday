import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { type RoomState, LiveEvent, roomStateSchema } from '@funfriday/contracts';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/infra/database/prisma.service.js';
import { RoomManager } from '../src/modules/live/room-manager.js';
import { startApp } from './app-harness.js';
import { createOrg, signUpVerified } from './identity-fixtures.js';
import {
  type LiveClient as Client,
  LiveClient,
  type LiveOrg,
  START_GAME,
  createLiveOrg,
  createSession,
  listen,
  percentile,
  sleep,
} from './live-helpers.js';

const PARTICIPANTS = 19;

describe('live gateway (real sockets)', () => {
  let app: NestExpressApplication;
  let url: string;
  let org: LiveOrg;
  const open: Client[] = [];

  async function connect(user: { cookie: string }): Promise<Client> {
    const result = await LiveClient.open(url, user.cookie);
    if ('error' in result) throw new Error(`connect failed: ${result.error.message}`);
    open.push(result.client);
    return result.client;
  }

  async function joinAs(user: { cookie: string }, sessionId: string): Promise<Client> {
    const client = await connect(user);
    await client.joined(sessionId);
    return client;
  }

  const roundOf = (state: RoomState) => state.view.game!.round!;

  beforeAll(async () => {
    app = await startApp();
    url = await listen(app);
    org = await createLiveOrg(app, 'sock', PARTICIPANTS);
  }, 120_000);

  afterEach(() => {
    for (const client of open.splice(0)) client.close();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('handshake', () => {
    it('rejects a missing session with UNAUTHENTICATED', async () => {
      const result = await LiveClient.open(url, undefined);
      expect(result).toEqual({ error: expect.objectContaining({ code: 'UNAUTHENTICATED' }) });
    });

    it('rejects a garbage cookie with UNAUTHENTICATED', async () => {
      const result = await LiveClient.open(url, 'better-auth.session_token=nope.nope');
      expect(result).toEqual({ error: expect.objectContaining({ code: 'UNAUTHENTICATED' }) });
    });

    it('rejects a foreign or missing Origin with FORBIDDEN even with a valid session', async () => {
      const user = org.members[0]!.user;
      const foreign = await LiveClient.open(url, user.cookie, 'https://evil.example');
      expect(foreign).toEqual({ error: expect.objectContaining({ code: 'FORBIDDEN' }) });
      const missing = await LiveClient.open(url, user.cookie, null);
      expect(missing).toEqual({ error: expect.objectContaining({ code: 'FORBIDDEN' }) });
    });

    it('connects with a valid session and allow-listed Origin', async () => {
      const client = await connect(org.members[0]!.user);
      expect(client.socket.connected).toBe(true);
    });
  });

  describe('join', () => {
    it('answers ROOM_NOT_FOUND for another organisation, an unknown session and an ended session', async () => {
      const session = await createSession(org, org.host);
      const outsider = await signUpVerified(app, 'sock-outsider');
      await createOrg(outsider, 'Outsider org');
      const out = await connect(outsider);
      const member = await connect(org.members[0]!.user);

      const foreign = await out.join(session.id);
      const unknown = await member.join(randomUUID());
      const ended = await createSession(org, org.host, 'Ended one');
      await app.get(PrismaService).liveSession.update({
        where: { id: ended.id },
        data: { status: 'ENDED', endedAt: new Date() },
      });
      const endedAck = await member.join(ended.id);

      expect(foreign).toEqual({ status: 'rejected', code: 'ROOM_NOT_FOUND' });
      expect(unknown).toEqual({ status: 'rejected', code: 'ROOM_NOT_FOUND' });
      expect(endedAck).toEqual({ status: 'rejected', code: 'ROOM_NOT_FOUND' });
    });

    it('rejects a malformed payload with BAD_REQUEST and never throws', async () => {
      const client = await connect(org.members[0]!.user);
      expect(await client.emitAck(LiveEvent.join, { sessionId: 'nope' })).toEqual({
        status: 'rejected',
        code: 'BAD_REQUEST',
      });
      expect(await client.emitAck(LiveEvent.join, undefined)).toEqual({
        status: 'rejected',
        code: 'BAD_REQUEST',
      });
    });

    it('seats a member: state matches roomStateSchema, host flags are right, participant row exists', async () => {
      const session = await createSession(org, org.host);
      const host = await connect(org.host);
      const guest = await connect(org.members[0]!.user);
      const admin = await connect(org.admin);
      const hostState = await host.joined(session.id);
      const guestState = await guest.joined(session.id);
      const adminState = await admin.joined(session.id);
      expect(roomStateSchema.parse(guestState).view.status).toBe('lobby');
      expect(hostState.view.me).toEqual({ memberId: org.hostMembershipId, isHost: true });
      expect(guestState.view.me.isHost).toBe(false);
      expect(adminState.view.me.isHost).toBe(true);
      expect(adminState.view.participants.map((p) => p.memberId)).toEqual(
        expect.arrayContaining([org.hostMembershipId, org.members[0]!.membershipId]),
      );
      const rows = await app
        .get(PrismaService)
        .sessionParticipant.count({ where: { sessionId: session.id } });
      expect(rows).toBe(3);
      // The other seated sockets were told about the newcomers.
      await host.waitFor(
        (s) => s.view.participants.length === 3,
        3_000,
        'host sees 3 participants',
      );
    });

    it('holds one session per socket: joining another leaves the first', async () => {
      const a = await createSession(org, org.host, 'Room A');
      const b = await createSession(org, org.host, 'Room B');
      const watcher = await joinAs(org.host, a.id);
      const mover = await joinAs(org.members[0]!.user, a.id);
      await watcher.waitFor(
        (s) => s.view.participants.some((p) => p.connected && !p.isHost),
        3_000,
      );
      await mover.joined(b.id);
      await watcher.waitFor(
        (s) =>
          s.view.participants.find((p) => p.memberId === org.members[0]!.membershipId)
            ?.connected === false,
        3_000,
        'mover marked away from room A',
      );
      // The old session no longer accepts actions from that socket.
      const ack = await mover.emitAck(LiveEvent.ready, {
        sessionId: a.id,
        ready: true,
        clientActionId: randomUUID(),
      });
      expect(ack).toMatchObject({ status: 'rejected', code: 'ROOM_NOT_FOUND' });
    });

    it('keeps the member connected while a second tab is open, and disconnects only after the last one', async () => {
      const session = await createSession(org, org.host);
      const watcher = await joinAs(org.host, session.id);
      const tab1 = await joinAs(org.members[0]!.user, session.id);
      const tab2 = await joinAs(org.members[0]!.user, session.id);
      const seat = (s: RoomState) =>
        s.view.participants.find((p) => p.memberId === org.members[0]!.membershipId);
      await watcher.waitFor((s) => seat(s)?.connected === true, 3_000);
      expect(watcher.latest.view.participants).toHaveLength(2);
      tab1.close();
      await sleep(250);
      expect(seat(watcher.latest)?.connected).toBe(true);
      tab2.close();
      await watcher.waitFor((s) => seat(s)?.connected === false, 3_000, 'last tab closed');
    });
  });

  describe('authorisation of actions', () => {
    it('refuses actions for a session the socket has not joined (including another org)', async () => {
      const session = await createSession(org, org.host);
      const client = await connect(org.members[0]!.user);
      const ack = await client.host(session.id, { type: 'end_session' });
      expect(ack).toMatchObject({ status: 'rejected', code: 'ROOM_NOT_FOUND' });
      const action = await client.answer(session.id, 'r1-x', 'A');
      expect(action).toMatchObject({ status: 'rejected', code: 'ROOM_NOT_FOUND' });
      expect(await client.emitAck(LiveEvent.resync, { sessionId: session.id })).toEqual({
        status: 'rejected',
        code: 'ROOM_NOT_FOUND',
      });
    });

    it('lets an organisation Admin run host commands; a HOST-role user who is not the session host gets NOT_HOST', async () => {
      const session = await createSession(org, org.host);
      const otherHost = await signUpVerified(app, 'sock-otherhost');
      const { joinOrg } = await import('./identity-fixtures.js');
      await joinOrg(app, org.admin, org.orgId, otherHost, 'host');
      const admin = await joinAs(org.admin, session.id);
      const impostor = await joinAs(otherHost, session.id);
      expect(await impostor.host(session.id, START_GAME)).toMatchObject({
        status: 'rejected',
        code: 'NOT_HOST',
      });
      expect(await admin.host(session.id, START_GAME)).toMatchObject({ status: 'accepted' });
    });

    it('re-checks the database on every host command: a demoted Admin gets NOT_HOST, a removed member FORBIDDEN', async () => {
      const session = await createSession(org, org.host);
      const prisma = app.get(PrismaService);
      const { joinOrg } = await import('./identity-fixtures.js');
      const second = await signUpVerified(app, 'sock-admin2');
      const membershipId = await joinOrg(app, org.admin, org.orgId, second, 'admin');
      const c = await joinAs(second, session.id);
      expect(c.latest.view.me.isHost).toBe(true);
      await prisma.membership.update({
        where: { id: membershipId },
        data: { role: 'PARTICIPANT' },
      });
      expect(await c.host(session.id, START_GAME)).toMatchObject({
        status: 'rejected',
        code: 'NOT_HOST',
      });
      await prisma.membership.delete({ where: { id: membershipId } });
      expect(await c.host(session.id, START_GAME)).toMatchObject({
        status: 'rejected',
        code: 'FORBIDDEN',
      });
      // The socket was dropped from the room: later actions find no seat.
      expect(await c.answer(session.id, 'r1-x', 'A')).toMatchObject({ code: 'ROOM_NOT_FOUND' });
    });

    it('rejects an invalid game action payload without changing state', async () => {
      const session = await createSession(org, org.host);
      const host = await joinAs(org.host, session.id);
      await host.host(session.id, START_GAME);
      const before = host.latest.revision;
      const bad = await host.emitAck(LiveEvent.gameAction, {
        sessionId: session.id,
        clientActionId: randomUUID(),
        action: { type: 'answer', roundId: roundOf(host.latest).id, choice: 'C' },
      });
      expect(bad).toMatchObject({ status: 'rejected', code: 'INVALID_ACTION', revision: before });
      const noId = await host.emitAck(LiveEvent.gameAction, { sessionId: session.id, action: {} });
      expect(noId).toMatchObject({ status: 'rejected', code: 'BAD_REQUEST' });
    });
  });

  describe('a full game with host + 2 participants', () => {
    it('plays two rounds with identical revisions for all, duplicates, stale rounds, privacy and aggregate persistence', async () => {
      const session = await createSession(org, org.host, 'Full game');
      const [p1, p2] = [org.members[0]!, org.members[1]!];
      const host = await joinAs(org.host, session.id);
      const c1 = await joinAs(p1.user, session.id);
      const c2 = await joinAs(p2.user, session.id);
      await host.waitFor((s) => s.view.participants.length === 3, 3_000);

      // Participants cannot control the game.
      expect(await c1.host(session.id, START_GAME)).toMatchObject({
        status: 'rejected',
        code: 'NOT_HOST',
      });

      const startId = randomUUID();
      const started = await host.host(session.id, START_GAME, startId);
      expect(started.status).toBe('accepted');
      // Replaying the same clientActionId must not start a second game or bump the revision.
      const replay = await host.host(session.id, START_GAME, startId);
      expect(replay).toEqual({ status: 'duplicate', revision: started.revision });

      for (const c of [host, c1, c2])
        await c.waitFor((s) => s.view.game?.phase === 'question', 3_000);
      const round1 = roundOf(c1.latest);
      expect(round1.number).toBe(1);
      expect(c1.latest.view.game!.reveal).toBeNull();

      // Stale / foreign round id.
      expect(await c1.answer(session.id, 'r9-stale', 'A')).toMatchObject({
        status: 'rejected',
        code: 'ROUND_CLOSED',
      });

      const answerId = randomUUID();
      const first = await c1.answer(session.id, round1.id, 'A', answerId);
      expect(first.status).toBe('accepted');
      const dup = await c1.answer(session.id, round1.id, 'A', answerId);
      expect(dup).toEqual({ status: 'duplicate', revision: first.revision });
      // A second, different action id for the same round is refused by the rules (no changes allowed).
      expect(await c1.answer(session.id, round1.id, 'B')).toMatchObject({
        status: 'rejected',
        code: 'DUPLICATE_ACTION',
      });

      await host.waitFor((s) => s.view.game?.answeredCount === 1, 3_000);
      // Counts stay hidden until the reveal; others still see no choice of p1.
      expect(host.latest.view.game!.myChoice).toBeNull();
      expect(c2.latest.view.game!.reveal).toBeNull();

      expect((await c2.answer(session.id, round1.id, 'B')).status).toBe('accepted');
      expect((await host.answer(session.id, round1.id, 'A')).status).toBe('accepted');

      for (const c of [host, c1, c2])
        await c.waitFor((s) => s.view.game?.phase === 'reveal', 3_000, 'reveal');
      for (const c of [host, c1, c2]) {
        expect(c.latest.view.game!.reveal).toEqual({ a: 2, b: 1, pass: 0 });
        expect(c.latest.view.game!.answeredCount).toBe(3);
      }
      expect(c1.latest.view.game!.myChoice).toBe('A');
      expect(c2.latest.view.game!.myChoice).toBe('B');

      // Round 2: host advances, everyone passes or answers B.
      expect((await host.host(session.id, { type: 'next_round' })).status).toBe('accepted');
      for (const c of [host, c1, c2])
        await c.waitFor((s) => s.view.game?.round?.number === 2, 3_000);
      const round2 = roundOf(host.latest);
      expect(round2.id).not.toBe(round1.id);
      // The previous round id is now closed.
      expect(await c1.answer(session.id, round1.id, 'A')).toMatchObject({
        status: 'rejected',
        code: 'ROUND_CLOSED',
      });
      await Promise.all([
        host.answer(session.id, round2.id, 'pass'),
        c1.answer(session.id, round2.id, 'B'),
        c2.answer(session.id, round2.id, 'B'),
      ]);
      for (const c of [host, c1, c2])
        await c.waitFor(
          (s) => s.view.game?.phase === 'reveal' && s.view.game.round?.number === 2,
          3_000,
        );
      expect(c2.latest.view.game!.reveal).toEqual({ a: 0, b: 2, pass: 1 });

      // Ordering: strictly increasing revisions per client; identical sequence once everyone was present.
      for (const c of [host, c1, c2]) {
        const r = c.revisions;
        expect(r).toEqual([...r].sort((x, y) => x - y));
        expect(new Set(r).size).toBe(r.length);
      }
      const common = Math.max(...[host, c1, c2].map((c) => c.revisions[0]!));
      const seq = (c: Client) => c.revisions.filter((rev) => rev >= common);
      expect(seq(c1)).toEqual(seq(host));
      expect(seq(c2)).toEqual(seq(host));

      // Privacy: no payload ever carries other members' answers.
      for (const [c, mine] of [
        [host, ['A', 'pass']],
        [c1, ['A', 'B']],
        [c2, ['B']],
      ] as const) {
        for (const { state } of c.states) {
          const json = JSON.stringify(state);
          expect(json).not.toContain('"answers"');
          const choice = state.view.game?.myChoice;
          if (choice) expect(mine).toContain(choice);
        }
      }

      // End: GameResult is aggregate-only; session closes.
      expect((await host.host(session.id, { type: 'end_game' })).status).toBe('accepted');
      expect((await host.host(session.id, { type: 'end_session' })).status).toBe('accepted');
      for (const c of [host, c1, c2])
        await c.waitFor((s) => s.view.status === 'ended', 3_000, 'ended');
      expect(host.latest.view.lastSummary!.summary.rounds).toHaveLength(2);

      const prisma = app.get(PrismaService);
      const result = await pollFor(async () =>
        prisma.gameResult.findFirst({ where: { sessionId: session.id } }),
      );
      expect(result.gameSlug).toBe('this-or-that');
      const summaryJson = JSON.stringify(result.summary);
      for (const id of [
        org.hostMembershipId,
        p1.membershipId,
        p2.membershipId,
        p1.user.userId,
        p2.user.userId,
      ]) {
        expect(summaryJson).not.toContain(id);
      }
      expect((result.summary as { rounds: unknown[] }).rounds).toHaveLength(2);
      const row = await pollFor(async () => {
        const s = await prisma.liveSession.findUniqueOrThrow({ where: { id: session.id } });
        return s.status === 'ENDED' ? s : null;
      });
      expect(row.startedAt).not.toBeNull();
      expect(row.endedAt).not.toBeNull();

      // An ended session cannot be joined or acted on.
      const late = await connect(p1.user);
      expect(await late.join(session.id)).toEqual({ status: 'rejected', code: 'ROOM_NOT_FOUND' });
    });
  });

  describe('concurrency', () => {
    it('counts the same action id once when it is sent five times at once', async () => {
      const session = await createSession(org, org.host);
      const host = await joinAs(org.host, session.id);
      const c1 = await joinAs(org.members[0]!.user, session.id);
      await host.host(session.id, START_GAME);
      await c1.waitFor((s) => s.view.game?.phase === 'question', 3_000);
      const roundId = roundOf(c1.latest).id;
      const id = randomUUID();
      const acks = await Promise.all(
        Array.from({ length: 5 }, () => c1.answer(session.id, roundId, 'A', id)),
      );
      expect(acks.filter((a) => a.status === 'accepted')).toHaveLength(1);
      expect(acks.filter((a) => a.status === 'duplicate')).toHaveLength(4);
      await host.waitFor((s) => s.view.game?.answeredCount === 1, 3_000);
      expect(new Set(acks.map((a) => a.revision)).size).toBe(1);
    });

    it('serialises a close_round racing with ten answers: every ack agrees with the final reveal', async () => {
      const session = await createSession(org, org.host);
      const host = await joinAs(org.host, session.id);
      const clients = await Promise.all(
        org.members.slice(0, 10).map((m) => joinAs(m.user, session.id)),
      );
      await host.host(session.id, START_GAME);
      await Promise.all(
        clients.map((c) => c.waitFor((s) => s.view.game?.phase === 'question', 3_000)),
      );
      const roundId = roundOf(host.latest).id;
      const [acks, close] = await Promise.all([
        Promise.all(clients.map((c) => c.answer(session.id, roundId, 'A'))),
        host.host(session.id, { type: 'close_round' }),
      ]);
      expect(close.status).toBe('accepted');
      const accepted = acks.filter((a) => a.status === 'accepted').length;
      const closed = acks.filter(
        (a) => a.status === 'rejected' && a.code === 'ROUND_CLOSED',
      ).length;
      expect(accepted + closed).toBe(10);
      for (const c of [host, ...clients])
        await c.waitFor((s) => s.view.game?.phase === 'reveal', 3_000);
      const finalRevisions = new Set([host, ...clients].map((c) => c.latest.revision));
      expect(finalRevisions.size).toBe(1);
      expect(host.latest.view.game!.reveal).toEqual({ a: accepted, b: 0, pass: 0 });
    });

    it.each([2, 5])(
      '%i clients answer concurrently: all counted once and every client sees the same revision sequence',
      async (n) => {
        const session = await createSession(org, org.host, `Room of ${n}`);
        const users = [org.host, ...org.members.slice(0, n - 1).map((m) => m.user)];
        const clients = await Promise.all(users.map((u) => connect(u)));
        for (const c of clients) await c.joined(session.id);
        await Promise.all(
          clients.map((c) =>
            c.waitFor((s) => s.view.participants.length === n, 3_000, 'all seated'),
          ),
        );
        await clients[0]!.host(session.id, START_GAME);
        await Promise.all(
          clients.map((c) => c.waitFor((s) => s.view.game?.phase === 'question', 3_000)),
        );
        const roundId = roundOf(clients[0]!.latest).id;
        const startRevision = clients[0]!.latest.revision;
        const acks = await Promise.all(
          clients.map((c, i) => c.answer(session.id, roundId, i % 2 === 0 ? 'A' : 'B')),
        );
        expect(acks.every((a) => a.status === 'accepted')).toBe(true);
        await Promise.all(
          clients.map((c) => c.waitFor((s) => s.view.game?.phase === 'reveal', 5_000, 'reveal')),
        );
        const a = Math.ceil(n / 2);
        for (const c of clients) {
          expect(c.latest.revision).toBe(startRevision + n);
          expect(c.latest.view.game!.reveal).toEqual({ a, b: n - a, pass: 0 });
        }
        // Every client saw the exact same revisions from the point everyone was seated.
        const seated = Math.max(
          ...clients.map(
            (c) => c.states.find((st) => st.state.revision >= startRevision)!.state.revision,
          ),
        );
        const seq = clients.map((c) => c.revisions.filter((r) => r >= seated));
        for (const s of seq) expect(s).toEqual(seq[0]);
        process.stderr.write(
          `[evidence] ${n} clients: revisions seen by all: ${seq[0]!.join(',')}\n`,
        );
      },
    );

    it('20 clients join together and answer concurrently: exactly 20 counted, one final revision, measured latency', async () => {
      const session = await createSession(org, org.host, 'Twenty');
      const users = [org.host, ...org.members.map((m) => m.user)];
      expect(users).toHaveLength(20);

      const connected = await Promise.all(users.map((u) => connect(u)));
      const tJoin = performance.now();
      await Promise.all(connected.map((c) => c.joined(session.id)));
      const joinMs = performance.now() - tJoin;
      const [host, ...others] = connected as [Client, ...Client[]];
      await Promise.all(
        connected.map((c) =>
          c.waitFor((s) => s.view.participants.length === 20, 5_000, '20 seated'),
        ),
      );

      await host.host(session.id, START_GAME);
      await Promise.all(
        connected.map((c) => c.waitFor((s) => s.view.game?.phase === 'question', 5_000)),
      );
      const roundId = roundOf(host.latest).id;
      const startRevision = host.latest.revision;

      const choices = ['A', 'B', 'pass'] as const;
      const t0 = performance.now();
      const ackMs: number[] = [];
      const acks = await Promise.all(
        connected.map(async (c, i) => {
          const sent = performance.now();
          const ack = await c.answer(session.id, roundId, choices[i % 3]!);
          ackMs.push(performance.now() - sent);
          return ack;
        }),
      );
      expect(acks.every((a) => a.status === 'accepted')).toBe(true);
      await Promise.all(
        connected.map((c) => c.waitFor((s) => s.view.game?.phase === 'reveal', 10_000, 'reveal')),
      );
      const settleMs = connected.map((c) => c.states.at(-1)!.at - t0);

      const finals = new Set(connected.map((c) => c.latest.revision));
      expect(finals.size).toBe(1);
      expect([...finals][0]).toBe(startRevision + 20);
      const reveal = host.latest.view.game!.reveal!;
      expect(reveal.a + reveal.b + reveal.pass).toBe(20);
      expect(reveal).toEqual({ a: 7, b: 7, pass: 6 });
      expect(host.latest.view.game!.answeredCount).toBe(20);
      for (const c of connected) {
        const r = c.revisions;
        expect(new Set(r).size).toBe(r.length);
        expect(r).toEqual([...r].sort((x, y) => x - y));
        expect(c.latest.view.game!.myChoice).toBe(choices[connected.indexOf(c) % 3]);
      }
      void others;
      process.stderr.write(
        `[evidence] 20 clients: join-all=${joinMs.toFixed(0)}ms; answer ack p50=${percentile(ackMs, 50).toFixed(0)}ms p95=${percentile(ackMs, 95).toFixed(0)}ms max=${Math.max(...ackMs).toFixed(0)}ms; ` +
          `answer->final-state at every client p50=${percentile(settleMs, 50).toFixed(0)}ms p95=${percentile(settleMs, 95).toFixed(0)}ms max=${Math.max(...settleMs).toFixed(0)}ms; ` +
          `revisions ${startRevision}->${[...finals][0]}\n`,
      );
    });
  });

  describe('disconnect, host exit and reconnect', () => {
    it('keeps the same seat and myChoice after a dropped socket reconnects', async () => {
      const session = await createSession(org, org.host);
      const host = await joinAs(org.host, session.id);
      const c1 = await joinAs(org.members[0]!.user, session.id);
      const c2 = await joinAs(org.members[1]!.user, session.id);
      await host.host(session.id, START_GAME);
      await c1.waitFor((s) => s.view.game?.phase === 'question', 3_000);
      const roundId = roundOf(c1.latest).id;
      expect((await c1.answer(session.id, roundId, 'B')).status).toBe('accepted');
      const seatsBefore = c1.latest.view.participants.map((p) => p.memberId).sort();

      c1.close();
      const seat = (s: RoomState) =>
        s.view.participants.find((p) => p.memberId === org.members[0]!.membershipId);
      await host.waitFor((s) => seat(s)?.connected === false, 3_000, 'seat shows disconnected');
      // Others keep playing; the dropped member's answer still counts.
      expect(host.latest.view.game!.answeredCount).toBe(1);

      const back = await connect(org.members[0]!.user);
      const state = await back.joined(session.id);
      expect(state.view.me.memberId).toBe(org.members[0]!.membershipId);
      expect(state.view.game!.myChoice).toBe('B');
      expect(state.view.game!.round!.id).toBe(roundId);
      expect(state.view.participants.map((p) => p.memberId).sort()).toEqual(seatsBefore);
      await host.waitFor((s) => seat(s)?.connected === true, 3_000, 'seat reconnected');
      // A duplicate answer after reconnect is still refused (not double counted).
      expect(await back.answer(session.id, roundId, 'B')).toMatchObject({
        status: 'rejected',
        code: 'DUPLICATE_ACTION',
      });
      void c2;
    });

    it('survives a reconnect burst: ten connect/disconnect cycles leave one connected seat', async () => {
      const session = await createSession(org, org.host);
      const watcher = await joinAs(org.host, session.id);
      const user = org.members[2]!.user;
      for (let i = 0; i < 10; i += 1) {
        const c = await connect(user);
        await c.joined(session.id);
        c.close();
      }
      const last = await joinAs(user, session.id);
      const seat = (s: RoomState) =>
        s.view.participants.find((p) => p.memberId === org.members[2]!.membershipId);
      await watcher.waitFor(
        (s) =>
          (seat(s)?.connected === true && s.revision === last.latest.revision) ||
          seat(s)?.connected === true,
        3_000,
      );
      await sleep(200);
      expect(seat(watcher.latest)?.connected).toBe(true);
      expect(
        watcher.latest.view.participants.filter((p) => p.memberId === org.members[2]!.membershipId),
      ).toHaveLength(1);
      expect(watcher.latest.view.participants).toHaveLength(2);
      const r = watcher.revisions;
      expect(r).toEqual([...r].sort((x, y) => x - y));
    });

    it('keeps the room running when the host drops: no host transfer, round still closes, host can return', async () => {
      const session = await createSession(org, org.host);
      const host = await joinAs(org.host, session.id);
      const c1 = await joinAs(org.members[0]!.user, session.id);
      const c2 = await joinAs(org.members[1]!.user, session.id);
      await host.host(session.id, START_GAME);
      await c1.waitFor((s) => s.view.game?.phase === 'question', 3_000);
      const roundId = roundOf(c1.latest).id;

      host.close();
      await c1.waitFor(
        (s) => s.view.participants.find((p) => p.isHost)?.connected === false,
        3_000,
        'host gone',
      );
      // Nobody else became host.
      expect(c1.latest.view.participants.filter((p) => p.isHost)).toHaveLength(1);
      expect(c1.latest.view.me.isHost).toBe(false);
      expect(await c1.host(session.id, { type: 'close_round' })).toMatchObject({
        status: 'rejected',
        code: 'NOT_HOST',
      });

      // The remaining connected players finish the round without the host (auto-reveal).
      await c1.answer(session.id, roundId, 'A');
      await c2.answer(session.id, roundId, 'B');
      await c1.waitFor((s) => s.view.game?.phase === 'reveal', 3_000, 'auto reveal without host');
      expect(c1.latest.view.game!.reveal).toEqual({ a: 1, b: 1, pass: 0 });

      const back = await joinAs(org.host, session.id);
      expect(back.latest.view.me.isHost).toBe(true);
      expect((await back.host(session.id, { type: 'next_round' })).status).toBe('accepted');
    });

    it('resync returns the current redacted state', async () => {
      const session = await createSession(org, org.host);
      const c = await joinAs(org.members[0]!.user, session.id);
      const res = await c.emitAck<{ status: string; state: RoomState }>(LiveEvent.resync, {
        sessionId: session.id,
      });
      expect(res.status).toBe('joined');
      expect(roomStateSchema.parse(res.state).revision).toBe(c.latest.revision);
    });
  });

  describe('abuse limits', () => {
    it('rate limits a burst of 40 events per socket with RATE_LIMITED', async () => {
      const session = await createSession(org, org.host);
      const c = await joinAs(org.members[0]!.user, session.id);
      const acks = await Promise.all(
        Array.from({ length: 40 }, () =>
          c.emitAck<{ status: string; code?: string }>(LiveEvent.resync, { sessionId: session.id }),
        ),
      );
      const limited = acks.filter(
        (a) => a.status === 'rejected' && a.code === 'RATE_LIMITED',
      ).length;
      const served = acks.filter((a) => a.status === 'joined').length;
      expect(limited).toBeGreaterThanOrEqual(10);
      expect(served).toBeGreaterThanOrEqual(15);
      expect(limited + served).toBe(40);
      process.stderr.write(
        `[evidence] burst of 40 events: ${served} served, ${limited} RATE_LIMITED\n`,
      );
      // The bucket refills: after a moment the socket works again.
      await sleep(600);
      expect(
        (await c.emitAck<{ status: string }>(LiveEvent.resync, { sessionId: session.id })).status,
      ).toBe('joined');
    });

    it('drops a socket that sends a message above the 16 KB limit', async () => {
      const c = await connect(org.members[0]!.user);
      const closed = new Promise<string>((resolve) => c.socket.once('disconnect', resolve));
      c.socket.emit(LiveEvent.join, { sessionId: 'x'.repeat(40_000) });
      expect(await Promise.race([closed, sleep(3_000).then(() => 'still-open')])).not.toBe(
        'still-open',
      );
    });
  });

  it('evicts an idle room only when no deadline is pending, and rehydrates it from Redis', async () => {
    const manager = app.get(RoomManager);
    const running = await createSession(org, org.host);
    const quiet = await createSession(org, org.host);

    // Room 1: round still running (deadline pending) - never evicted.
    const h1 = await joinAs(org.host, running.id);
    await h1.host(running.id, START_GAME);
    h1.close();
    // Room 2: finished round (reveal, no deadline) - evictable.
    const h2 = await joinAs(org.host, quiet.id);
    const g2 = await joinAs(org.members[0]!.user, quiet.id);
    await h2.host(quiet.id, START_GAME);
    await g2.waitFor((s) => s.view.game?.phase === 'question', 3_000);
    const roundId = roundOf(g2.latest).id;
    await h2.answer(quiet.id, roundId, 'A');
    await g2.answer(quiet.id, roundId, 'B');
    await g2.waitFor((s) => s.view.game?.phase === 'reveal', 3_000);
    h2.close();
    g2.close();
    await pollFor(() =>
      Promise.resolve(
        manager.peek(quiet.id)?.connectionCount === 0 &&
          manager.peek(running.id)?.connectionCount === 0
          ? true
          : null,
      ),
    );
    await sleep(100);
    const before = manager.peek(quiet.id)!.revision;

    const previous = manager.idleEvictionMs;
    manager.idleEvictionMs = 0;
    try {
      manager.sweep(Date.now() + 1);
    } finally {
      manager.idleEvictionMs = previous;
    }
    expect(manager.peek(running.id)).toBeDefined();
    expect(manager.peek(quiet.id)).toBeUndefined();

    const back = await joinAs(org.members[0]!.user, quiet.id);
    expect(back.latest.view.game!.phase).toBe('reveal');
    expect(back.latest.view.game!.reveal).toEqual({ a: 1, b: 1, pass: 0 });
    expect(back.latest.view.game!.myChoice).toBe('B');
    expect(back.latest.revision).toBeGreaterThanOrEqual(before);
  });
});

async function pollFor<T>(fn: () => Promise<T | null>, timeoutMs = 5_000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await fn();
    if (value) return value;
    await sleep(25);
  }
  throw new Error('pollFor timed out');
}
