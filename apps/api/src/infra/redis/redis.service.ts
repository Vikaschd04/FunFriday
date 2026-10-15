import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';

/** Namespace for every FunFriday key so a shared Redis never collides. */
export const REDIS_KEY_PREFIX = 'ff:';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private healthy = true;
  readonly client: Redis;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = new Redis(config.redisUrl, {
      lazyConnect: true,
      keyPrefix: REDIS_KEY_PREFIX,
      connectTimeout: 2_000,
      maxRetriesPerRequest: 1,
      // Commands fail immediately while disconnected instead of queueing;
      // a health probe or game action must never get a false "accepted".
      enableOfflineQueue: false,
      retryStrategy: (attempt) => Math.min(attempt * 250, 2_000),
    });
    this.client.on('ready', () => {
      if (!this.healthy) this.logger.log('Redis connection restored');
      this.healthy = true;
    });
    this.client.on('error', (error: Error) => {
      // Log transitions only (never the URL), not every retry.
      if (this.healthy) this.logger.warn(`Redis unavailable: ${error.message}`);
      this.healthy = false;
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch {
      // Startup continues; readiness reports Redis as down and ioredis retries.
    }
  }

  async ping(): Promise<void> {
    const reply = await this.client.ping();
    if (reply !== 'PONG') {
      throw new Error('unexpected PING reply');
    }
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
