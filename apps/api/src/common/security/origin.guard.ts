import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defence in depth (ADR 0002): a state-changing request that carries ANY
 * cookie (fail closed, not just our cookie names) must come from an allow-listed web origin. Requests without the
 * cookie are unauthenticated and are rejected by the session guard instead.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!STATE_CHANGING.has(req.method)) return true;
    if (!req.headers.cookie) return true;
    const origin = req.headers.origin;
    if (typeof origin !== 'string' || !this.config.webOrigins.includes(origin)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
