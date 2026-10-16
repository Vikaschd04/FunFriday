import { Injectable, Logger } from '@nestjs/common';
import type { RoomEffect, RoomSnapshot } from '@funfriday/game-core';
import { PrismaService } from '../../infra/database/prisma.service.js';

const RETRY_DELAY_MS = 250;

/**
 * Applies room effects to Postgres. Every effect is idempotent (conditional updates, and
 * GameResult insert-on-conflict-do-nothing on (session, startedAt)), so it is safe to retry and
 * to re-apply when a restarted room finds Postgres behind its snapshot. Aggregate data only.
 */
@Injectable()
export class SessionEffects {
  private readonly logger = new Logger(SessionEffects.name);
  /** Mutable so tests can shorten it. */
  retryDelayMs = RETRY_DELAY_MS;

  constructor(private readonly prisma: PrismaService) {}

  /** One attempt plus one retry after a short backoff; the final failure is logged with ids only. */
  async applyWithRetry(snapshot: RoomSnapshot, effect: RoomEffect, now: number): Promise<void> {
    try {
      await this.apply(snapshot, effect, now);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      try {
        await this.apply(snapshot, effect, now);
      } catch {
        this.logger.error(`effect failed session=${snapshot.sessionId} effect=${effect.type}`);
      }
    }
  }

  /** Brings Postgres up to what a rehydrated snapshot says already happened. */
  async reconcile(snapshot: RoomSnapshot, now: number): Promise<void> {
    const game = snapshot.game;
    if (game) {
      await this.applyWithRetry(
        snapshot,
        { type: 'game_started', slug: game.slug },
        game.startedAt,
      );
      if (game.state.phase === 'finished' && snapshot.lastSummary) {
        await this.applyWithRetry(
          snapshot,
          {
            type: 'game_finished',
            slug: game.slug,
            startedAt: game.startedAt,
            summary: snapshot.lastSummary.summary,
          },
          now,
        );
      }
    }
    if (snapshot.status === 'ended') {
      await this.applyWithRetry(snapshot, { type: 'session_ended' }, now);
    }
  }

  async apply(snapshot: RoomSnapshot, effect: RoomEffect, now: number): Promise<void> {
    const where = { id: snapshot.sessionId, organizationId: snapshot.organizationId };
    switch (effect.type) {
      case 'game_started':
        // First game stamps startedAt; ended sessions are never resurrected.
        await this.prisma.liveSession.updateMany({
          where: { ...where, startedAt: null },
          data: { startedAt: new Date(now) },
        });
        await this.prisma.liveSession.updateMany({
          where: { ...where, status: 'LOBBY' },
          data: { status: 'LIVE' },
        });
        return;
      case 'game_finished':
        await this.prisma.gameResult.createMany({
          data: [
            {
              organizationId: snapshot.organizationId,
              sessionId: snapshot.sessionId,
              gameSlug: effect.slug,
              startedAt: new Date(effect.startedAt),
              endedAt: new Date(Math.max(now, effect.startedAt)),
              summary: effect.summary,
            },
          ],
          skipDuplicates: true,
        });
        return;
      case 'session_ended':
        await this.prisma.liveSession.updateMany({
          where: { ...where, status: { not: 'ENDED' } },
          data: { status: 'ENDED', endedAt: new Date(now) },
        });
        return;
    }
  }
}
