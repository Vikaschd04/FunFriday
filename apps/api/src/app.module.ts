import { type DynamicModule, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from './config/app-config.js';
import { InfraModule } from './infra/infra.module.js';
import { ActivitiesModule } from './modules/activities/activities.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({})
export class AppModule {
  /** Config is parsed once at bootstrap and injected, so tests can supply their own. */
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      global: true,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
      imports: [InfraModule, HealthModule, ActivitiesModule],
    };
  }
}
