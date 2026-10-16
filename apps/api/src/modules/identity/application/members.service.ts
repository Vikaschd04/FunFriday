import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  type AddMemberRequest,
  type Member,
  type MemberListResponse,
  INVITATION_TTL_DAYS,
  type OrgRole,
  memberListResponseSchema,
  memberSchema,
} from '@funfriday/contracts';
import {
  ConflictDomainException,
  LastAdminException,
} from '../../../common/errors/domain.exception.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { APP_CONFIG, type AppConfig } from '../../../config/app-config.js';
import { MailerPort } from '../../mail/mailer.port.js';
import { PrismaService } from '../../../infra/database/prisma.service.js';
import {
  leavesNoActiveAdmin,
  toContractRole,
  toContractStatus,
  toDbRole,
} from '../domain/roles.js';
import { AuditService } from './audit.service.js';
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
} from '../domain/invitation-token.js';

type MembershipRow = Prisma.MembershipGetPayload<{
  include: { user: { select: { name: true; email: true } } };
}>;

const withUser = { user: { select: { name: true, email: true } } } as const;

/** Role-redacted DTO: email only for Admin callers. Invited rows have no name. */
function toMember(row: MembershipRow, includeEmail: boolean): Member {
  return memberSchema.parse({
    id: row.id,
    name: row.user?.name ?? null,
    ...(includeEmail ? { email: row.user?.email ?? row.invitedEmail } : {}),
    role: toContractRole(row.role),
    status: toContractStatus(row.status),
    joinedAt: row.joinedAt ? row.joinedAt.toISOString() : null,
  });
}

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mailer: MailerPort,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(organizationId: string, includeEmail: boolean): Promise<MemberListResponse> {
    const rows = await this.prisma.membership.findMany({
      where: { organizationId },
      include: withUser,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return memberListResponseSchema.parse({
      members: rows.map((row) => toMember(row, includeEmail)),
    });
  }

  /**
   * Always creates an INVITED membership and never looks up accounts, so the response is the
   * same whether or not the email has one (no enumeration). The invitee joins only by
   * presenting the emailed one-time token (D026); only its SHA-256 hash is stored.
   */
  async add(organizationId: string, actorUserId: string, input: AddMemberRequest): Promise<Member> {
    const id = randomUUID();
    const token = generateInvitationToken();
    const { row, orgName } = await this.prisma.$transaction(async (tx) => {
      const inserted = await tx.membership.createMany({
        data: [
          {
            id,
            organizationId,
            invitedEmail: input.email,
            role: toDbRole(input.role),
            status: 'INVITED',
            inviteTokenHash: hashInvitationToken(token),
            inviteExpiresAt: invitationExpiry(),
            invitedByUserId: actorUserId,
          },
        ],
        skipDuplicates: true,
      });
      if (inserted.count === 0) throw new ConflictDomainException();
      await this.audit.record(tx, {
        organizationId,
        actorUserId,
        action: 'membership.added',
        targetType: 'membership',
        targetId: id,
        metadata: { role: input.role },
      });
      const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
      const created = await tx.membership.findFirstOrThrow({
        where: { id, organizationId },
        include: withUser,
      });
      return { row: created, orgName: org.name };
    });

    try {
      await this.mailer.send({
        to: input.email,
        subject: `You're invited to join ${orgName} on FunFriday`,
        text:
          `You have been invited to join ${orgName} on FunFriday as ${input.role}.\n\n` +
          `Accept the invitation (sign in with this email address first):\n` +
          `${this.config.webOrigins[0]}/invitations/accept?token=${token}\n\n` +
          `The link works once and expires in ${INVITATION_TTL_DAYS} days. ` +
          `If you were not expecting this, ignore this message.`,
      });
    } catch {
      // Without the email the invitation is unusable: undo it rather than leave a dead row.
      await this.prisma.membership.deleteMany({ where: { id, organizationId } });
      this.logger.error('invitation mail could not be queued');
      throw new ServiceUnavailableException();
    }
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, {
        organizationId,
        actorUserId,
        action: 'invitation.sent',
        targetType: 'membership',
        targetId: id,
        metadata: { role: input.role },
      }),
    );
    return toMember(row, true);
  }

  async changeRole(
    organizationId: string,
    actorUserId: string,
    memberId: string,
    role: OrgRole,
  ): Promise<Member> {
    const row = await this.prisma.$transaction(async (tx) => {
      const activeAdmins = await this.lockActiveAdmins(tx, organizationId);
      const target = await tx.membership.findFirst({ where: { id: memberId, organizationId } });
      if (!target) throw new NotFoundException();
      const newRole = toDbRole(role);
      if (target.role !== newRole) {
        if (
          leavesNoActiveAdmin({
            targetRole: target.role,
            targetStatus: target.status,
            newRole,
            activeAdminCount: activeAdmins,
          })
        ) {
          throw new LastAdminException();
        }
        await tx.membership.update({ where: { id: target.id }, data: { role: newRole } });
        await this.audit.record(tx, {
          organizationId,
          actorUserId,
          action: 'membership.role_changed',
          targetType: 'membership',
          targetId: target.id,
          metadata: { from: toContractRole(target.role), to: role },
        });
      }
      return tx.membership.findFirstOrThrow({
        where: { id: memberId, organizationId },
        include: withUser,
      });
    });
    return toMember(row, true);
  }

  async remove(organizationId: string, actorUserId: string, memberId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const activeAdmins = await this.lockActiveAdmins(tx, organizationId);
      const target = await tx.membership.findFirst({ where: { id: memberId, organizationId } });
      if (!target) throw new NotFoundException();
      if (
        leavesNoActiveAdmin({
          targetRole: target.role,
          targetStatus: target.status,
          newRole: 'REMOVED',
          activeAdminCount: activeAdmins,
        })
      ) {
        throw new LastAdminException();
      }
      // Team memberships go with it via ON DELETE CASCADE on the composite FK.
      await tx.membership.delete({ where: { id: target.id } });
      await this.audit.record(tx, {
        organizationId,
        actorUserId,
        action: 'membership.removed',
        targetType: 'membership',
        targetId: target.id,
        metadata: { role: toContractRole(target.role) },
      });
    });
  }

  /**
   * Locks the organisation's ACTIVE admin rows (FOR UPDATE) so two concurrent demotions
   * cannot both pass the last-admin check. Returns the locked count.
   */
  private async lockActiveAdmins(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM memberships
      WHERE organization_id = ${organizationId}::uuid
        AND role = 'ADMIN'::"OrgRole" AND status = 'ACTIVE'::"MembershipStatus"
      ORDER BY id
      FOR UPDATE`;
    return rows.length;
  }
}
