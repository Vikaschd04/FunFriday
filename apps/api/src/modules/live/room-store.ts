import { Injectable, Logger } from '@nestjs/common';
import type { RoomSnapshot } from '@funfriday/game-core';
import { roomSnapshotSchema } from './room-snapshot.schema.js';
import { RedisService } from '../../infra/redis/redis.service.js';

export const ROOM_SNAPSHOT_TTL_SECONDS = 6 * 60 * 60;

/** Thrown when Redis cannot be read or written; callers map it to SERVICE_UNAVAILABLE. */
export class RoomStoreUnavailableError extends Error {
  constructor() {
    super('room snapshot store unavailable');
    this.name = 'RoomStoreUnavailableError';
  }
}

const keyOf = (sessionId: string): string => `room:${sessionId}`;

/** Latest revisioned room snapshot per session (key `ff:room:{sessionId}`, TTL 6 h). */
@Injectable()
export class RoomStore {
  private readonly logger = new Logger(RoomStore.name);

  constructor(private readonly redis: RedisService) {}

  async save(snapshot: RoomSnapshot): Promise<void> {
    try {
      const reply = await this.redis.client.set(
        keyOf(snapshot.sessionId),
        JSON.stringify(snapshot),
        'EX',
        ROOM_SNAPSHOT_TTL_SECONDS,
      );
      if (reply !== 'OK') throw new Error('unexpected SET reply');
    } catch {
      this.logger.warn(`snapshot write failed session=${snapshot.sessionId}`);
      throw new RoomStoreUnavailableError();
    }
  }

  /** Null when no usable snapshot exists (missing or invalid). A Redis failure throws, never "looks like an empty room". */
  async load(sessionId: string): Promise<RoomSnapshot | null> {
    let raw: string | null;
    try {
      raw = await this.redis.client.get(keyOf(sessionId));
    } catch {
      this.logger.warn(`snapshot read failed session=${sessionId}`);
      throw new RoomStoreUnavailableError();
    }
    if (raw === null) return null;
    try {
      return roomSnapshotSchema.parse(JSON.parse(raw));
    } catch {
      // Corrupt or tampered: never adopt it. The caller rebuilds the lobby from Postgres.
      this.logger.error(`snapshot rejected (invalid shape) session=${sessionId}`);
      return null;
    }
  }
}
