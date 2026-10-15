import { type LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_PREFIX } from '@funfriday/contracts';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { REQUEST_ID_HEADER, requestIdMiddleware } from './common/http/request-id.js';
import type { AppConfig } from './config/app-config.js';

export interface CreateAppOptions {
  logger?: false | LogLevel[];
}

export async function createApp(
  config: AppConfig,
  options: CreateAppOptions = {},
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    logger: options.logger ?? ['log', 'warn', 'error'],
  });
  configureApp(app, config);
  return app;
}

/** HTTP hardening shared by the real server and integration tests. */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.useBodyParser('json', { limit: '100kb' });
  app.enableCors({
    origin: config.webOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
}
