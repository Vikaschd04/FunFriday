import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AcceptInvitationResponse,
  type InvitationPreviewResponse,
  acceptInvitationResponseSchema,
  invitationPreviewResponseSchema,
} from '@funfriday/contracts';
import {
  ConflictDomainException,
  DomainException,
} from '../../../common/errors/domain.exception.js';
import { PrismaService } from '../../../infra/database/prisma.service.js';
import type { SessionUser } from '../../auth/auth-session.port.js';
import { hashInvitationToken } from '../domain/invitation-token.js';
import { toContractRole } from '../domain/roles.js';
import { AuditService } from './audit.service.js';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Unknown, used or cleared tokens are all 404; an expired one is 410. */
  private async find(token: string) {
    const invitation = await this.prisma.membership.findUnique({
      where: { inviteTokenHash: hashInvitationToken(token) },
      include: { organization: { select: { id: true, slug: true, name: true } } },
    });
    if (!invitation || invitation.status !== 'INVITED') throw new NotFoundException();
    if (!invitation.inviteExpiresAt || invitation.inviteExpiresAt <= new Date()) {
      throw new DomainException('INVITE_EXPIRED', HttpStatus.GONE);
    }
    return invitation;
  }

  async preview(user: SessionUser, token: string): Promise<InvitationPreviewResponse> {
    const invitation = await this.find(token);
    const existing = await this.prisma.membership.findFirst({
      where: { organizationId: invitation.organizationId, userId: user.userId, status: 'ACTIVE' },
      select: { id: true },
    });
    return invitationPreviewResponseSchema.parse({
      organization: invitation.organization,
      role: toContractRole(invitation.role),
      emailMatches: user.email.toLowerCase() === invitation.invitedEmail,
      alreadyMember: existing !== null,
    });
  }

  /**
   * Joining needs BOTH the emailed token (inbox control) and a session whose email is the
   * invited address (account control). A conditional update makes the token single-use even
   * under concurrent requests. Accepting proves inbox control, so it verifies the email.
   */
  async accept(user: SessionUser, token: string): Promise<AcceptInvitationResponse> {
    const invitation = await this.find(token);
    if (user.email.toLowerCase() !== invitation.invitedEmail) {
      throw new DomainException('INVITE_EMAIL_MISMATCH', HttpStatus.FORBIDDEN);
    }
    const already = await this.prisma.membership.findFirst({
      where: { organizationId: invitation.organizationId, userId: user.userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (already) throw new ConflictDomainException();

    const tokenHash = hashInvitationToken(token);
    try {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.membership.updateMany({
          where: {
            id: invitation.id,
            status: 'INVITED',
            inviteTokenHash: tokenHash,
            inviteExpiresAt: { gt: new Date() },
          },
          data: {
            userId: user.userId,
            status: 'ACTIVE',
            joinedAt: new Date(),
            inviteTokenHash: null,
            inviteExpiresAt: null,
          },
        });
        if (claimed.count !== 1) throw new NotFoundException();
        await tx.user.update({ where: { id: user.userId }, data: { emailVerified: true } });
        await this.audit.record(tx, {
          organizationId: invitation.organizationId,
          actorUserId: user.userId,
          action: 'membership.claimed',
          targetType: 'membership',
          targetId: invitation.id,
          metadata: { role: toContractRole(invitation.role) },
        });
      });
    } catch (error) {
      // unique(organizationId, userId): the user became a member of this org concurrently.
      if ((error as { code?: string }).code === 'P2002') throw new ConflictDomainException();
      throw error;
    }
    return acceptInvitationResponseSchema.parse({
      organization: invitation.organization,
      role: toContractRole(invitation.role),
    });
  }
}
