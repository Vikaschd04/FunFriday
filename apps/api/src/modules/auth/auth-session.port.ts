import type { IncomingHttpHeaders } from 'node:http';

export interface SessionUser {
  userId: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

/**
 * Provider-neutral session lookup (ADR 0002). Guards, controllers and the P4 socket
 * handshake depend on this port only, never on the auth library.
 */
export abstract class AuthSessionPort {
  abstract getSession(headers: IncomingHttpHeaders): Promise<SessionUser | null>;
}
