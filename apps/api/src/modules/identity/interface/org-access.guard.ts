import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { z } from 'zod';
import type {
  MembershipRole,
  OrgMembershipContext,
  RequestWithContext,
} from '../../../common/http/request-context.js';
import { PrismaService } from '../../../infra/database/prisma.service.js';
import { type OrgRole } from '@funfriday/contracts';
import { toDbRole } from '../domain/roles.js';

const ROLES_KEY = 'ff:org-roles';
const uuid = z.uuid();

/** Roles allowed on a route; omit the decorator to allow any ACTIVE member. */
export const OrgRoles = (...roles: OrgRole[]) => SetMetadata(ROLES_KEY, roles.map(toDbRole));

/**
 * Tenant guard (D023). Requires a prior SessionGuard. Resolves the caller's ACTIVE membership
 * in `:orgId`: unknown org, malformed id and non-membership are all 404 (no existence leak);
 * a member with an insufficient role gets 403.
 */
@Injectable()
export class OrgAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithContext>();
    if (!req.authUser) throw new UnauthorizedException();
    const orgId = (req.params as Record<string, string | undefined>).orgId;
    if (!orgId || !uuid.safeParse(orgId).success) throw new NotFoundException();

    const membership = await this.prisma.membership.findFirst({
      where: { organizationId: orgId, userId: req.authUser.userId, status: 'ACTIVE' },
      select: { id: true, organizationId: true, role: true },
    });
    if (!membership) throw new NotFoundException();

    const allowed = this.reflector.getAllAndOverride<MembershipRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed && !allowed.includes(membership.role)) throw new ForbiddenException();

    req.membership = {
      membershipId: membership.id,
      organizationId: membership.organizationId,
      role: membership.role,
    };
    return true;
  }
}

/** The caller's resolved membership (requires OrgAccessGuard). */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, context: ExecutionContext): OrgMembershipContext => {
    const req: RequestWithContext = context.switchToHttp().getRequest();
    const membership = req.membership;
    if (!membership) throw new ForbiddenException();
    return membership;
  },
);
