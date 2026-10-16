import { type LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_PREFIX } from '@funfriday/contracts';
import helmet from 'helmet';
import { LiveIoAdapter } from './modules/live/live-io.adapter.js';
import type { Clock } from './modules/live/clock.js';
import { AppModule } from './app.module.js';
import { CLIENT_IP_HEADER } from './common/http/request-context.js';
import { AUTH_BASE_PATH } from './modules/auth/auth-options.js';
import { AuthService } from './modules/auth/auth.service.js';
import type { NextFunction, Request, Response } from 'express';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { REQUEST_ID_HEADER, requestIdMiddleware } from './common/http/request-id.js';
import type { AppConfig } from './config/app-config.js';

export interface CreateAppOptions {
  logger?: false | LogLevel[];
  /** Test seam: drives server-side deadlines. */
  clock?: Clock;
}

export async function createApp(
  config: AppConfig,
  options: CreateAppOptions = {},
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.forRoot(config, { clock: options.clock }),
    {
      logger: options.logger ?? ['log', 'warn', 'error'],
      // Body parsing is registered manually in configureApp: the auth handler must see the raw stream.
      bodyParser: false,
    },
  );
  configureApp(app, config);
  return app;
}

const AUTH_MAX_BODY_BYTES = 64 * 1024;

/** An `http-errors`-shaped client error, rendered by the shared exception filter. */
function clientError(status: number): Error & { status: number; expose: boolean } {
  return Object.assign(new Error('client error'), { status, expose: true });
}

/**
 * The auth handler reads the raw stream with no size cap of its own, so cap it here: reject
 * declared bodies over 64 KiB (413) and chunked bodies with no declared length (411).
 */
export function limitAuthBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const length = req.headers['content-length'];
    if (length === undefined) {
      if (req.headers['transfer-encoding'] !== undefined) return next(clientError(411));
    } else if (!/^\d+$/.test(length) || Number(length) > AUTH_MAX_BODY_BYTES) {
      return next(clientError(Number(length) > AUTH_MAX_BODY_BYTES ? 413 : 400));
    }
  }
  next();
}

/** HTTP hardening shared by the real server and integration tests. */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.set('trust proxy', config.trustProxy);
  app.enableCors({
    origin: config.webOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  // Better Auth (ADR 0002) at /api/v1/auth/*. It reads the raw request stream, so it is
  // mounted before the JSON body parser. Express 5 wildcard syntax.
  const authHandler = app.get(AuthService).nodeHandler;
  app
    .getHttpAdapter()
    .getInstance()
    .all(
      `${AUTH_BASE_PATH}/*splat`,
      limitAuthBody,
      (req: Request, _res: Response, next: NextFunction) => {
        // The library rate-limits by this header; always overwrite it with the peer address
        // so a client cannot spoof its way past the limits.
        req.headers[CLIENT_IP_HEADER] = req.ip ?? 'unknown';
        next();
      },
      authHandler,
    );
  app.useBodyParser('json', { limit: '100kb' });
  app.useWebSocketAdapter(new LiveIoAdapter(app, config));
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
}
