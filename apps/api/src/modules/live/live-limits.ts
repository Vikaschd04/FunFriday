import { Injectable } from '@nestjs/common';
import { TokenBucket } from './token-bucket.js';

/** Hard caps on concurrent live sockets (abuse / fan-out protection). */
export const MAX_SOCKETS_PER_USER = 5;
export const MAX_SOCKETS_PER_USER_PER_SESSION = 3;

interface Tracked {
  /** Session ids this socket is (or is about to be) attached to. */
  attached: Set<string>;
}

/** Per-user socket registry and event bucket shared across all of one user's sockets. */
@Injectable()
export class LiveLimits {
  private readonly users = new Map<
    string,
    { sockets: Map<string, Tracked>; bucket: TokenBucket }
  >();

  /** False when the user already has the maximum number of sockets. */
  register(userId: string, socketId: string, tracked: Tracked): boolean {
    let entry = this.users.get(userId);
    if (!entry) {
      entry = { sockets: new Map(), bucket: new TokenBucket() };
      this.users.set(userId, entry);
    }
    if (entry.sockets.size >= MAX_SOCKETS_PER_USER) return false;
    entry.sockets.set(socketId, tracked);
    return true;
  }

  unregister(userId: string, socketId: string): void {
    const entry = this.users.get(userId);
    if (!entry) return;
    entry.sockets.delete(socketId);
    if (entry.sockets.size === 0) this.users.delete(userId);
  }

  /** Sockets of this user already attached (or attaching) to the session. */
  sessionCount(userId: string, sessionId: string): number {
    const entry = this.users.get(userId);
    if (!entry) return 0;
    return [...entry.sockets.values()].filter((t) => t.attached.has(sessionId)).length;
  }

  /** Shared event budget (about 10/s, burst 20) across every socket of the user. */
  take(userId: string): boolean {
    return this.users.get(userId)?.bucket.take() ?? true;
  }
}
