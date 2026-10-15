import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type DependencyCheck,
  type LivenessResponse,
  type ReadinessResponse,
  SERVICE_NAME,
  livenessResponseSchema,
  readinessResponseSchema,
} from '@funfriday/contracts';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';
import { PrismaService } from '../../infra/database/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { DEPENDENCY_TIMEOUT_MS, summarizeReadiness, withTimeout } from './health.logic.js';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  liveness(): LivenessResponse {
    return livenessResponseSchema.parse({
      status: 'ok',
      service: SERVICE_NAME,
      time: new Date().toISOString(),
    });
  }

  async readiness(): Promise<ReadinessResponse> {
    const [database, redis] = await Promise.all([
      this.check('database', () => this.prisma.$queryRaw`SELECT 1`),
      this.check('redis', () => this.redis.ping()),
    ]);
    const checks = { database, redis };
    return readinessResponseSchema.parse({
      status: summarizeReadiness(checks),
      service: SERVICE_NAME,
      version: this.config.version,
      time: new Date().toISOString(),
      checks,
    });
  }

  private async check(name: string, probe: () => Promise<unknown>): Promise<DependencyCheck> {
    const started = performance.now();
    try {
      await withTimeout(probe(), DEPENDENCY_TIMEOUT_MS);
      return { status: 'up', latencyMs: Math.round(performance.now() - started) };
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'unknown';
      this.logger.warn(`Readiness check failed: ${name} (${reason})`);
      return { status: 'down', latencyMs: Math.round(performance.now() - started) };
    }
  }
}
