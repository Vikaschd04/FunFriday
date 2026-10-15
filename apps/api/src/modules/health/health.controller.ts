import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common';
import type { LivenessResponse, ReadinessResponse } from '@funfriday/contracts';
import type { Response } from 'express';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness: the process is up. Never checks dependencies. */
  @Get('live')
  @Header('Cache-Control', 'no-store')
  live(): LivenessResponse {
    return this.health.liveness();
  }

  /** Readiness: 200 only when Postgres and Redis respond; 503 otherwise. */
  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessResponse> {
    const body = await this.health.readiness();
    if (body.status !== 'ready') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return body;
  }
}
