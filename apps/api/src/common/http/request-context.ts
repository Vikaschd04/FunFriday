import type { Request } from 'express';
import type { SessionUser } from '../../modules/auth/auth-session.port.js';

export type MembershipRole = 'ADMIN' | 'HOST' | 'PARTICIPANT';

/** The caller's resolved ACTIVE membership for the `:orgId` in the URL. */
export interface OrgMembershipContext {
  membershipId: string;
  organizationId: string;
  role: MembershipRole;
}

export interface RequestWithContext extends Request {
  authUser?: SessionUser;
  membership?: OrgMembershipContext;
}

/** Header set by our middleware (never the client) so the auth library rate-limits on the real peer IP. */
export const CLIENT_IP_HEADER = 'x-funfriday-client-ip';
