import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type CreateOrganizationRequest,
  type MeResponse,
  type OrganizationSummary,
  meResponseSchema,
  organizationSummarySchema,
} from '@funfriday/contracts';
import { PrismaService } from '../../../infra/database/prisma.service.js';
import type { SessionUser } from '../../auth/auth-session.port.js';
import { slugify, toContractRole } from '../domain/roles.js';
import { AuditService } from './audit.service.js';

const MAX_SLUG_ATTEMPTS = 6;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Creates the organisation with the caller as its first ACTIVE admin, in one transaction. */
  async create(user: SessionUser, input: CreateOrganizationRequest): Promise<OrganizationSummary> {
    const base = slugify(input.name);
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      const slug = attempt === 0 ? base : `${base}-${randomBytes(3).toString('hex')}`;
      const created = await this.prisma.$transaction(async (tx) => {
        const id = randomUUID();
        // ON CONFLICT DO NOTHING keeps the transaction usable when the slug is taken.
        const inserted = await tx.organization.createMany({
          data: [{ id, slug, name: input.name }],
          skipDuplicates: true,
        });
        if (inserted.count === 0) return null;
        const membership = await tx.membership.create({
          data: {
            organizationId: id,
            userId: user.userId,
            invitedEmail: user.email.toLowerCase(),
            role: 'ADMIN',
            status: 'ACTIVE',
            joinedAt: new Date(),
          },
        });
        await this.audit.record(tx, {
          organizationId: id,
          actorUserId: user.userId,
          action: 'organization.created',
          targetType: 'organization',
          targetId: id,
          metadata: { role: 'admin' },
        });
        return { id, membershipId: membership.id };
      });
      if (created) return this.summary(created.id, 'ADMIN');
    }
    throw new Error('could not allocate a unique organisation slug');
  }

  async get(
    organizationId: string,
    role: 'ADMIN' | 'HOST' | 'PARTICIPANT',
  ): Promise<OrganizationSummary> {
    return this.summary(organizationId, role);
  }

  private async summary(
    organizationId: string,
    role: 'ADMIN' | 'HOST' | 'PARTICIPANT',
  ): Promise<OrganizationSummary> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException();
    const memberCount = await this.prisma.membership.count({
      where: { organizationId, status: 'ACTIVE' },
    });
    return organizationSummarySchema.parse({
      id: org.id,
      slug: org.slug,
      name: org.name,
      myRole: toContractRole(role),
      memberCount,
      createdAt: org.createdAt.toISOString(),
    });
  }

  /**
   * The signed-in user plus ACTIVE memberships. Read-only: invitations are joined only by
   * presenting the emailed token (D026), never by matching an email here.
   */
  async me(user: SessionUser): Promise<MeResponse> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.userId, status: 'ACTIVE' },
      include: { organization: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return meResponseSchema.parse({
      user: {
        id: user.userId,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
      },
      memberships: memberships.map((m) => ({
        organization: {
          id: m.organization.id,
          slug: m.organization.slug,
          name: m.organization.name,
        },
        role: toContractRole(m.role),
      })),
      needsEmailVerification: !user.emailVerified,
    });
  }
}
