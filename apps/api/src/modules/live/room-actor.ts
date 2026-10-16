import { randomInt } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { ActionAck, ErrorCode, RoomState } from '@funfriday/contracts';
import {
  type RoomCommand,
  type RoomEffect,
  type RoomSnapshot,
  nextRoomDeadline,
  reduceRoom,
  roomView,
} from '@funfriday/game-core';
import type { Clock } from './clock.js';
import type { RoomStore } from './room-store.js';

/** One live socket attached to the room. `send` must never throw into the actor. */
export interface RoomConnection {
  id: string;
  memberId: string;
  send(state: RoomState): void;
  /** Forcibly drops the underlying socket (membership revoked). */
  close(): void;
}

export interface RoomActorDeps {
  store: RoomStore;
  clock: Clock;
  /** Persists side effects (Postgres). Failures are logged by the actor; they never undo a commit. */
  onEffect: (snapshot: RoomSnapshot, effect: RoomEffect, now: number) => Promise<void>;
}

const logger = new Logger('RoomActor');

/**
 * Authoritative state for ONE live session. Every state change goes through `enqueue`, so
 * commands run strictly one at a time: reduce (pure game-core) -> persist snapshot ->
 * commit -> broadcast redacted views -> reschedule the single deadline timer (ADR 0003).
 */
export class RoomActor {
  private snapshot: RoomSnapshot;
  private readonly connections = new Map<string, RoomConnection>();
  private queue: Promise<unknown> = Promise.resolve();
  private effectQueue: Promise<void> = Promise.resolve();
  private pending = 0;
  private cancelTimer: (() => void) | null = null;
  private disposed = false;
  /** Real-time moment the last socket left; null while someone is attached. */
  idleSince: number | null = Date.now();

  constructor(
    initial: RoomSnapshot,
    private readonly deps: RoomActorDeps,
  ) {
    this.snapshot = initial;
    // A snapshot recovered after a restart may already be past its deadline: tick right away.
    void this.enqueue(() => Promise.resolve(this.reschedule()));
  }

  get sessionId(): string {
    return this.snapshot.sessionId;
  }

  get revision(): number {
    return this.snapshot.revision;
  }

  get connectionCount(): number {
    return this.connections.size;
  }

  /** True when nothing is queued and nobody is attached (eviction candidate). */
  get isQuiet(): boolean {
    return this.pending === 0 && this.connections.size === 0;
  }

  /** The next deadline that still needs a timer (such rooms are never evicted). */
  get hasDeadline(): boolean {
    return nextRoomDeadline(this.snapshot) !== null;
  }

  /** Redacted view for one member of the CURRENT committed snapshot. */
  stateFor(memberId: string): RoomState {
    const now = this.deps.clock.now();
    return {
      revision: this.snapshot.revision,
      serverNow: now,
      view: roomView(this.snapshot, memberId, now),
    };
  }

  /** Joins a member and attaches the socket. The joining socket gets its state via the ack, not a broadcast. */
  attach(
    conn: RoomConnection,
    member: { name: string | null; isHost: boolean },
  ): Promise<ActionAck> {
    return this.enqueue(async () => {
      const ack = await this.apply({
        type: 'join',
        memberId: conn.memberId,
        name: member.name,
        isHost: member.isHost,
      });
      if (ack.status !== 'rejected') {
        this.connections.set(conn.id, conn);
        this.idleSince = null;
      }
      return ack;
    });
  }

  /** Detaches a socket; the member is marked disconnected only if no other socket of theirs remains. */
  detach(connId: string): Promise<void> {
    return this.enqueue(async () => {
      const conn = this.connections.get(connId);
      if (!conn) return;
      this.connections.delete(connId);
      if (this.connections.size === 0) this.idleSince = Date.now();
      const memberStillHere = [...this.connections.values()].some(
        (other) => other.memberId === conn.memberId,
      );
      if (!memberStillHere) await this.apply({ type: 'disconnect', memberId: conn.memberId });
    });
  }

  /** Membership removed: drop every socket of the member and mark them disconnected. */
  revoke(memberId: string): Promise<void> {
    return this.enqueue(async () => {
      for (const [id, conn] of [...this.connections]) {
        if (conn.memberId !== memberId) continue;
        this.connections.delete(id);
        try {
          conn.close();
        } catch {
          logger.warn(`close failed session=${this.snapshot.sessionId} conn=${id}`);
        }
      }
      if (this.connections.size === 0) this.idleSince = Date.now();
      await this.apply({ type: 'disconnect', memberId });
    });
  }

  /** Role changed: update a CONNECTED member's host flag in the room (join is idempotent for a seat). */
  setHost(memberId: string, isHost: boolean): Promise<void> {
    return this.enqueue(async () => {
      const member = this.snapshot.members[memberId];
      if (!member?.connected || member.isHost === isHost) return;
      await this.apply({ type: 'join', memberId, name: member.name, isHost });
    });
  }

  hasMember(memberId: string): boolean {
    return memberId in this.snapshot.members;
  }

  get organizationId(): string {
    return this.snapshot.organizationId;
  }

  /** Ready / host command / game action. Always resolves with an ack - never throws. */
  command(
    command: Exclude<RoomCommand, { type: 'join' | 'disconnect' | 'tick' }>,
    /** Authorisation re-check that runs INSIDE the queue, right before the command (no TOCTOU gap). */
    precheck?: () => Promise<ErrorCode | null>,
  ): Promise<ActionAck> {
    return this.enqueue(async () => {
      if (precheck) {
        let denied: ErrorCode | null;
        try {
          denied = await precheck();
        } catch {
          denied = 'SERVICE_UNAVAILABLE';
        }
        if (denied) return rejected(this.snapshot.revision, denied);
      }
      return this.apply(command);
    });
  }

  /** Waits for queued commands and effects (shutdown, tests). */
  async drain(): Promise<void> {
    await this.queue;
    await this.effectQueue;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.cancelTimer?.();
    this.cancelTimer = null;
    await this.drain();
    this.connections.clear();
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    this.pending += 1;
    const run = this.queue.then(() => fn());
    // The chain itself must survive a failing command.
    this.queue = run.catch(() => undefined).finally(() => (this.pending -= 1));
    return run;
  }

  private async apply(command: RoomCommand): Promise<ActionAck> {
    const before = this.snapshot;
    const now = this.deps.clock.now();
    try {
      const result = reduceRoom(before, command, { now, seed: () => randomInt(0, 2 ** 31) });
      if (result.outcome === 'accepted') {
        try {
          // Persist BEFORE commit: a failed write must never become a false "accepted".
          await this.deps.store.save(result.snapshot);
        } catch {
          return { status: 'rejected', revision: before.revision, code: 'SERVICE_UNAVAILABLE' };
        }
        this.snapshot = result.snapshot;
        this.broadcast(now);
        this.runEffects(result.snapshot, result.effects, now);
        return { status: 'accepted', revision: result.snapshot.revision };
      }
      if (result.outcome === 'noop') {
        // May carry idempotency memory (e.g. repeated ready); revision is unchanged.
        this.snapshot = result.snapshot;
        return { status: 'accepted', revision: this.snapshot.revision };
      }
      if (result.outcome === 'duplicate') {
        return { status: 'duplicate', revision: before.revision };
      }
      return rejected(before.revision, result.code ?? 'INVALID_ACTION');
    } catch (error) {
      logger.error(
        `command failed session=${before.sessionId} type=${command.type} error=${error instanceof Error ? error.name : 'unknown'}`,
      );
      return rejected(before.revision, 'INTERNAL_ERROR');
    } finally {
      this.reschedule();
    }
  }

  private broadcast(now: number): void {
    const { revision } = this.snapshot;
    for (const conn of this.connections.values()) {
      try {
        conn.send({ revision, serverNow: now, view: roomView(this.snapshot, conn.memberId, now) });
      } catch {
        logger.warn(`broadcast failed session=${this.snapshot.sessionId} conn=${conn.id}`);
      }
    }
  }

  private runEffects(snapshot: RoomSnapshot, effects: RoomEffect[], now: number): void {
    if (effects.length === 0) return;
    // Own queue: ordered (started -> finished -> ended) but never delays the next command.
    this.effectQueue = this.effectQueue.then(async () => {
      for (const effect of effects) {
        try {
          await this.deps.onEffect(snapshot, effect, now);
        } catch {
          logger.error(`effect failed session=${snapshot.sessionId} effect=${effect.type}`);
        }
      }
    });
  }

  /** Exactly one timer, always for the next game deadline. */
  private reschedule(): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
    if (this.disposed) return;
    const deadline = nextRoomDeadline(this.snapshot);
    if (deadline === null) return;
    this.cancelTimer = this.deps.clock.schedule(deadline, () => {
      this.cancelTimer = null;
      void this.enqueue(() => this.apply({ type: 'tick' }));
    });
  }
}

function rejected(revision: number, code: ErrorCode): ActionAck {
  return { status: 'rejected', revision, code };
}
