import type { IncomingHttpHeaders } from 'node:http';
import { Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { AuthService } from './auth.service.js';
import { AuthSessionPort, type SessionUser } from './auth-session.port.js';

@Injectable()
export class BetterAuthSessionAdapter extends AuthSessionPort {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async getSession(headers: IncomingHttpHeaders): Promise<SessionUser | null> {
    const result = await this.authService.auth.api.getSession({
      headers: fromNodeHeaders(headers),
    });
    if (!result) return null;
    return {
      userId: result.user.id,
      email: result.user.email,
      emailVerified: result.user.emailVerified,
      name: result.user.name,
    };
  }
}
