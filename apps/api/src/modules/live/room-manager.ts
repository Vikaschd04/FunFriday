import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { createRoom } from '@funfriday/game-core';
import { Clock } from './clock.js';
import { RoomActor } from './room-actor.js';
import { RoomStore } from './room-store.js';
import { SessionEffects } from './session-effects.js';

export const ACTOR_IDLE_EVICTION_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

export interface RoomSeed {
  id: string;
  organizationId: string;
  title: string;
  roomCode: string;
}

/** Process-local registry: one actor per live session (single instance per ADR 0003). */
@Injectable()
export class RoomManager implements OnModuleDestroy {
  private readonly logger = new Logger(RoomManager.name);
  private readonly actors = new Map<string, RoomActor>();
  private readonly loading = new Map<string, Promise<RoomActor>>();
  private readonly sweeper: NodeJS.Timeout;
  /** Mutable so tests can shorten it. */
  idleEvictionMs = ACTOR_IDLE_EVICTION_MS;

  constructor(
    private readonly store: RoomStore,
    private readonly clock: Clock,
    private readonly effects: SessionEffects,
  ) {
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweeper.unref();
  }

  get size(): number {
    return this.actors.size;
  }

  peek(sessionId: string): RoomActor | undefined {
    return this.actors.get(sessionId);
  }

  actorsForOrg(organizationId: string): RoomActor[] {
    return [...this.actors.values()].filter((a) => a.organizationId === organizationId);
  }

  /**
   * Returns the live actor, rehydrating from Redis (else a fresh lobby from Postgres).
   * Throws RoomStoreUnavailableError if Redis cannot be read - never a silent blank room.
   */
  acquire(seed: RoomSeed): Promise<RoomActor> {
    const existing = this.actors.get(seed.id);
    if (existing) return Promise.resolve(existing);
    const inflight = this.loading.get(seed.id);
    if (inflight) return inflight;
    const promise = (async () => {
      let stored = await this.store.load(seed.id);
      if (
        stored &&
        (stored.sessionId !== seed.id ||
          stored.organizationId !== seed.organizationId ||
          stored.roomCode !== seed.roomCode)
      ) {
        // Redis disagrees with Postgres about who owns this room: never adopt it.
        this.logger.error(`snapshot rejected (identity mismatch) session=${seed.id}`);
        stored = null;
      }
      const snapshot = stored
        ? {
            ...stored,
            // Nobody is attached after a (re)load: sockets re-join and flip themselves back on.
            members: Object.fromEntries(
              Object.entries(stored.members).map(([id, m]) => [id, { ...m, connected: false }]),
            ),
          }
        : createRoom({
            sessionId: seed.id,
            organizationId: seed.organizationId,
            title: seed.title,
            roomCode: seed.roomCode,
          });
      const actor = new RoomActor(snapshot, {
        store: this.store,
        clock: this.clock,
        onEffect: (snap, effect, now) => this.effects.applyWithRetry(snap, effect, now),
      });
      this.actors.set(seed.id, actor);
      // Postgres may be behind the snapshot if the process died between the Redis write and the effect.
      if (stored) {
        void this.effects.reconcile(snapshot, this.clock.now()).catch(() => {
          this.logger.error(`reconcile failed session=${seed.id}`);
        });
      }
      return actor;
    })().finally(() => this.loading.delete(seed.id));
    this.loading.set(seed.id, promise);
    return promise;
  }

  /** Evicts rooms nobody has been attached to for `idleEvictionMs` and with no pending deadline. */
  sweep(now = Date.now()): number {
    let evicted = 0;
    for (const [id, actor] of this.actors) {
      const idle = actor.idleSince !== null && now - actor.idleSince >= this.idleEvictionMs;
      if (idle && actor.isQuiet && !actor.hasDeadline) {
        this.actors.delete(id);
        void actor.dispose();
        evicted += 1;
        this.logger.log(`evicted idle room session=${id}`);
      }
    }
    return evicted;
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.sweeper);
    const actors = [...this.actors.values()];
    this.actors.clear();
    await Promise.all(actors.map((actor) => actor.dispose()));
  }
}
