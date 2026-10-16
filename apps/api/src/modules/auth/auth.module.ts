import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthSessionPort } from './auth-session.port.js';
import { BetterAuthSessionAdapter } from './better-auth-session.adapter.js';
import { SessionGuard } from './session.guard.js';

@Global()
@Module({
  providers: [
    AuthService,
    { provide: AuthSessionPort, useClass: BetterAuthSessionAdapter },
    SessionGuard,
  ],
  exports: [AuthService, AuthSessionPort, SessionGuard],
})
export class AuthModule {}
