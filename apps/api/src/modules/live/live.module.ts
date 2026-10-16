import { type DynamicModule, Module } from '@nestjs/common';
import { OrgAccessGuard } from '../identity/interface/org-access.guard.js';
import { Clock, SystemClock } from './clock.js';
import { LiveAccessPort } from './live-access.port.js';
import { LiveAccessService } from './live-access.service.js';
import { LiveLimits } from './live-limits.js';
import { LiveGateway } from './live.gateway.js';
import { RoomManager } from './room-manager.js';
import { RoomStore } from './room-store.js';
import { SessionEffects } from './session-effects.js';
import { JoinByCodeController, OrgSessionsController } from './sessions.controller.js';
import { RoomCodes, SessionsService } from './sessions.service.js';

@Module({})
export class LiveModule {
  /** `clock` lets integration tests drive server deadlines; production uses the system clock. */
  static register(clock?: Clock): DynamicModule {
    return {
      module: LiveModule,
      global: true,
      exports: [LiveAccessPort],
      controllers: [OrgSessionsController, JoinByCodeController],
      providers: [
        clock ? { provide: Clock, useValue: clock } : { provide: Clock, useClass: SystemClock },
        OrgAccessGuard,
        RoomCodes,
        RoomStore,
        SessionEffects,
        SessionsService,
        RoomManager,
        LiveLimits,
        { provide: LiveAccessPort, useClass: LiveAccessService },
        LiveGateway,
      ],
    };
  }
}
