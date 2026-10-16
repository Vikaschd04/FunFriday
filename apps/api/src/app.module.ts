import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { OriginGuard } from './common/security/origin.guard.js';
import { APP_CONFIG, type AppConfig } from './config/app-config.js';
import { InfraModule } from './infra/infra.module.js';
import { ActivitiesModule } from './modules/activities/activities.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { LiveModule } from './modules/live/live.module.js';
import type { Clock } from './modules/live/clock.js';
import { MailModule } from './modules/mail/mail.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({})
export class AppModule {
  /** Config is parsed once at bootstrap and injected, so tests can supply their own. */
  static forRoot(config: AppConfig, options: { clock?: Clock } = {}): DynamicModule {
    return {
      module: AppModule,
      global: true,
      providers: [
        { provide: APP_CONFIG, useValue: config },
        // Global guards run in this order: throttle first, then CSRF origin check.
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: OriginGuard },
      ],
      exports: [APP_CONFIG],
      imports: [
        // Per-IP baseline for every route; auth routes have stricter library-side limits.
        ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }] }),
        InfraModule,
        MailModule.register(config),
        AuthModule,
        HealthModule,
        ActivitiesModule,
        IdentityModule,
        LiveModule.register(options.clock),
      ],
    };
  }
}
