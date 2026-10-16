import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type Team,
  type TeamListResponse,
  teamListResponseSchema,
  teamSchema,
} from '@funfriday/contracts';
import { ConflictDomainException } from '../../../common/errors/domain.exception.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infra/database/prisma.service.js';
import { AuditService } from './audit.service.js';

const teamInclude = {
  members: {
    include: { membership: { select: { user: { select: { name: true } } } } },
    orderBy: [{ createdAt: 'asc' }, { membershipId: 'asc' }],
  },
} satisfies Prisma.TeamInclude;

type TeamRow = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;

const toTeam = (row: TeamRow): Team =>
  teamSchema.parse({
    id: row.id,
    name: row.name,
    members: row.members.map((m) => ({
      memberId: m.membershipId,
      name: m.membership.user?.name ?? null,
    })),
  });

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string): Promise<TeamListResponse> {
    const rows = await this.prisma.team.findMany({
      where: { organizationId },
      include: teamInclude,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return teamListResponseSchema.parse({ teams: rows.map(toTeam) });
  }

  async create(organizationId: string, actorUserId: string, name: string): Promise<Team> {
    const id = randomUUID();
    const row = await this.prisma.$transaction(async (tx) => {
      const inserted = await tx.team.createMany({
        data: [{ id, organizationId, name }],
        skipDuplicates: true,
      });
      if (inserted.count === 0) throw new ConflictDomainException();
      await this.audit.record(tx, {
        organizationId,
        actorUserId,
        action: 'team.created',
        targetType: 'team',
        targetId: id,
        metadata: { name },
      });
      return tx.team.findFirstOrThrow({ where: { id, organizationId }, include: teamInclude });
    });
    return toTeam(row);
  }

  async delete(organizationId: string, actorUserId: string, teamId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.findFirst({ where: { id: teamId, organizationId } });
      if (!team) throw new NotFoundException();
      await tx.team.delete({ where: { id: team.id } });
      await this.audit.record(tx, {
        organizationId,
        actorUserId,
        action: 'team.deleted',
        targetType: 'team',
        targetId: team.id,
        metadata: { name: team.name },
      });
    });
  }

  /** Idempotent: re-adding an existing member changes nothing and writes no audit row. */
  async addMember(
    organizationId: string,
    actorUserId: string,
    teamId: string,
    membershipId: string,
  ): Promise<Team> {
    const row = await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.findFirst({ where: { id: teamId, organizationId } });
      if (!team) throw new NotFoundException();
      // Scoped by organisation: a membership id from another tenant is simply not found.
      const membership = await tx.membership.findFirst({
        where: { id: membershipId, organizationId },
      });
      if (!membership) throw new NotFoundException();
      if (membership.status !== 'ACTIVE') throw new ConflictDomainException();
      const inserted = await tx.teamMember.createMany({
        data: [{ organizationId, teamId: team.id, membershipId: membership.id }],
        skipDuplicates: true,
      });
      if (inserted.count === 1) {
        await this.audit.record(tx, {
          organizationId,
          actorUserId,
          action: 'team.member_added',
          targetType: 'team',
          targetId: team.id,
          metadata: { teamName: team.name, memberId: membership.id },
        });
      }
      return tx.team.findFirstOrThrow({
        where: { id: teamId, organizationId },
        include: teamInclude,
      });
    });
    return toTeam(row);
  }

  async removeMember(
    organizationId: string,
    actorUserId: string,
    teamId: string,
    membershipId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.findFirst({ where: { id: teamId, organizationId } });
      if (!team) throw new NotFoundException();
      const removed = await tx.teamMember.deleteMany({
        where: { organizationId, teamId: team.id, membershipId },
      });
      if (removed.count === 0) throw new NotFoundException();
      await this.audit.record(tx, {
        organizationId,
        actorUserId,
        action: 'team.member_removed',
        targetType: 'team',
        targetId: team.id,
        metadata: { teamName: team.name, memberId: membershipId },
      });
    });
  }
}
