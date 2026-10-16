import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  type ActionAck,
  type JoinAck,
  type LiveSessionSummary,
  LiveEvent,
  type RoomState,
  THIS_OR_THAT,
  joinAckSchema,
  roomStateSchema,
} from '@funfriday/contracts';
import { io, type Socket } from 'socket.io-client';
import { Clock } from '../src/modules/live/clock.js';
import {
  type TestUser,
  WEB_ORIGIN,
  createOrg,
  joinOrg,
  signUpVerified,
} from './identity-fixtures.js';

/** Starts listening on an ephemeral port; returns the namespace URL. */
export async function listen(app: NestExpressApplication): Promise<string> {
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return `http://127.0.0.1:${port}/live`;
}

/** Controllable clock: deadlines fire only when the test advances time. */
export class TestClock extends Clock {
  private current: number;
  private timers: { at: number; fn: () => void; id: number }[] = [];
  private seq = 0;

  constructor(start = Date.now()) {
    super();
    this.current = start;
  }

  now(): number {
    return this.current;
  }

  schedule(atMs: number, fn: () => void): () => void {
    const id = (this.seq += 1);
    this.timers.push({ at: atMs, fn, id });
    // Already-due timers fire on the next macrotask, like setTimeout(0).
    if (atMs <= this.current) setTimeout(() => this.fire(), 0);
    return () => {
      this.timers = this.timers.filter((t) => t.id !== id);
    };
  }

  advance(ms: number): void {
    this.current += ms;
    this.fire();
  }

  private fire(): void {
    const due = this.timers.filter((t) => t.at <= this.current);
    this.timers = this.timers.filter((t) => t.at > this.current);
    for (const t of due) t.fn();
  }
}

export interface Recorded {
  at: number;
  state: RoomState;
}

export class LiveClient {
  readonly states: Recorded[] = [];

  private constructor(readonly socket: Socket) {
    socket.on(LiveEvent.state, (raw: unknown) => {
      this.states.push({ at: performance.now(), state: roomStateSchema.parse(raw) });
    });
  }

  static open(
    url: string,
    cookie: string | undefined,
    origin: string | null = WEB_ORIGIN,
  ): Promise<{ client: LiveClient } | { error: { code?: string; message: string } }> {
    const headers: Record<string, string> = {};
    if (cookie) headers.cookie = cookie;
    if (origin) headers.origin = origin;
    const socket = io(url, {
      transports: ['websocket'],
      extraHeaders: headers,
      reconnection: false,
      forceNew: true,
    });
    return new Promise((resolve) => {
      socket.once('connect', () => resolve({ client: new LiveClient(socket) }));
      socket.once('connect_error', (error: Error & { data?: { code?: string } }) => {
        socket.close();
        resolve({ error: { code: error.data?.code, message: error.message } });
      });
    });
  }

  static async connect(url: string, user: TestUser): Promise<LiveClient> {
    const result = await LiveClient.open(url, user.cookie);
    if ('error' in result) throw new Error(`connect failed: ${result.error.message}`);
    return result.client;
  }

  emitAck<T>(event: string, payload: unknown, timeoutMs = 5_000): Promise<T> {
    return this.socket.timeout(timeoutMs).emitWithAck(event, payload) as Promise<T>;
  }

  async join(sessionId: string): Promise<JoinAck> {
    return joinAckSchema.parse(await this.emitAck(LiveEvent.join, { sessionId }));
  }

  get latest(): RoomState {
    const last = this.states.at(-1);
    if (!last) throw new Error('no room:state received yet');
    return last.state;
  }

  /** The most recent known state, including the one delivered via the join ack. */
  remember(state: RoomState): void {
    const last = this.states.at(-1)?.state.revision ?? -1;
    if (state.revision > last) {
      this.states.push({ at: performance.now(), state });
    }
  }

  async waitFor(
    predicate: (state: RoomState) => boolean,
    timeoutMs = 5_000,
    label = 'condition',
  ): Promise<RoomState> {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      const last = this.states.at(-1);
      if (last && predicate(last.state)) return last.state;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error(
      `timed out waiting for ${label}; last revision ${this.states.at(-1)?.state.revision}`,
    );
  }

  host(sessionId: string, command: unknown, clientActionId = randomUUID()): Promise<ActionAck> {
    return this.emitAck(LiveEvent.hostCommand, { sessionId, clientActionId, command });
  }

  answer(
    sessionId: string,
    roundId: string,
    choice: 'A' | 'B' | 'pass',
    clientActionId = randomUUID(),
  ): Promise<ActionAck> {
    return this.emitAck(LiveEvent.gameAction, {
      sessionId,
      clientActionId,
      action: { type: 'answer', roundId, choice },
    });
  }

  /** Join and record the ack state like a real client would. */
  async joined(sessionId: string): Promise<RoomState> {
    const ack = await this.join(sessionId);
    if (ack.status !== 'joined') throw new Error(`join rejected: ${ack.code}`);
    this.remember(ack.state);
    return ack.state;
  }

  get revisions(): number[] {
    return this.states.map((s) => s.state.revision);
  }

  close(): void {
    this.socket.close();
  }
}

export const START_GAME = {
  type: 'start_game',
  game: THIS_OR_THAT,
  config: { rounds: 3, roundSeconds: 20, allowAnswerChange: false, packId: 'starter' },
} as const;

export interface LiveOrg {
  orgId: string;
  admin: TestUser;
  host: TestUser;
  hostMembershipId: string;
  members: { user: TestUser; membershipId: string }[];
}

/** One org with an Admin, a HOST-role user and `participants` PARTICIPANT-role users (all verified, ACTIVE). */
export async function createLiveOrg(
  app: NestExpressApplication,
  label: string,
  participants: number,
): Promise<LiveOrg> {
  const admin = await signUpVerified(app, `${label}-admin`);
  const orgId = await createOrg(admin, `Live ${label}`);
  const host = await signUpVerified(app, `${label}-host`);
  const hostMembershipId = await joinOrg(app, admin, orgId, host, 'host');
  const members = [];
  for (let i = 0; i < participants; i += 1) {
    const user = await signUpVerified(app, `${label}-p${i}`);
    members.push({ user, membershipId: await joinOrg(app, admin, orgId, user, 'participant') });
  }
  return { orgId, admin, host, hostMembershipId, members };
}

export async function createSession(
  org: { orgId: string },
  host: TestUser,
  title = 'Friday social',
): Promise<LiveSessionSummary> {
  const res = await host.agent
    .post(`/api/v1/organizations/${org.orgId}/sessions`)
    .send({ title })
    .expect(201);
  return res.body as LiveSessionSummary;
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}
