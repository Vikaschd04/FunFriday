import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { RequestWithContext } from '../../common/http/request-context.js';
import { AuthSessionPort, type SessionUser } from './auth-session.port.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: AuthSessionPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithContext>();
    const user = await this.sessions.getSession(req.headers);
    if (!user) {
      throw new UnauthorizedException();
    }
    req.authUser = user;
    return true;
  }
}

/** The authenticated user (requires SessionGuard). */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const req: RequestWithContext = context.switchToHttp().getRequest();
  const user = req.authUser;
  if (!user) throw new UnauthorizedException();
  return user;
});

export type { SessionUser };
