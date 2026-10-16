import { Throttle } from '@nestjs/throttler';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type AddMemberRequest,
  type AuditListResponse,
  type AcceptInvitationResponse,
  type CreateOrganizationRequest,
  type InvitationPreviewResponse,
  type InvitationTokenRequest,
  invitationTokenRequestSchema,
  type CreateTeamRequest,
  type AddTeamMemberRequest,
  type Member,
  type MemberListResponse,
  type MeResponse,
  type OrganizationSummary,
  type Team,
  type TeamListResponse,
  type UpdateMemberRequest,
  addMemberRequestSchema,
  addTeamMemberRequestSchema,
  createOrganizationRequestSchema,
  createTeamRequestSchema,
  updateMemberRequestSchema,
  auditListQuerySchema,
} from '@funfriday/contracts';
import { z } from 'zod';
import type { OrgMembershipContext } from '../../../common/http/request-context.js';
import { UuidParamPipe } from '../../../common/http/uuid-param.pipe.js';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe.js';
import { CurrentUser, SessionGuard } from '../../auth/session.guard.js';
import type { SessionUser } from '../../auth/auth-session.port.js';
import { AuditService } from '../application/audit.service.js';
import { InvitationsService } from '../application/invitations.service.js';
import { MembersService } from '../application/members.service.js';
import { OrganizationsService } from '../application/organizations.service.js';
import { TeamsService } from '../application/teams.service.js';
import { CurrentMembership, OrgAccessGuard, OrgRoles } from './org-access.guard.js';

@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  me(@CurrentUser() user: SessionUser): Promise<MeResponse> {
    return this.organizations.me(user);
  }
}

@Controller('organizations')
@UseGuards(SessionGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  create(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(createOrganizationRequestSchema)) body: CreateOrganizationRequest,
  ): Promise<OrganizationSummary> {
    return this.organizations.create(user, body);
  }

  @Get(':orgId')
  @UseGuards(OrgAccessGuard)
  @Header('Cache-Control', 'no-store')
  get(@CurrentMembership() membership: OrgMembershipContext): Promise<OrganizationSummary> {
    return this.organizations.get(membership.organizationId, membership.role);
  }
}

@Controller('organizations/:orgId/members')
@UseGuards(SessionGuard, OrgAccessGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentMembership() membership: OrgMembershipContext): Promise<MemberListResponse> {
    return this.members.list(membership.organizationId, membership.role === 'ADMIN');
  }

  @Post()
  @OrgRoles('admin')
  async add(
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: OrgMembershipContext,
    @Body(new ZodValidationPipe(addMemberRequestSchema)) body: AddMemberRequest,
  ): Promise<{ member: Member }> {
    return { member: await this.members.add(membership.organizationId, user.userId, body) };
  }

  @Patch(':memberId')
  @OrgRoles('admin')
  async update(
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: OrgMembershipContext,
    @Param('memberId', new UuidParamPipe()) memberId: string,
    @Body(new ZodValidationPipe(updateMemberRequestSchema)) body: UpdateMemberRequest,
  ): Promise<{ member: Member }> {
    return {
      member: await this.members.changeRole(
        membership.organizationId,
        user.userId,
        memberId,
        body.role,
      ),
    };
  }

  @Delete(':memberId')
  @OrgRoles('admin')
  @HttpCode(204)
  remove(
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: OrgMembershipContext,
    @Param('memberId', new UuidParamPipe()) memberId: string,
  ): Promise<void> {
    return this.members.remove(membership.organizationId, user.userId, memberId);
  }
}

@Controller('organizations/:orgId/teams')
@UseGuards(SessionGuard, OrgAccessGuard)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentMembership() membership: OrgMembershipContext): Promise<TeamListResponse> {
    return this.teams.list(membership.organizationId);
  }

  @Post()
  @OrgRoles('admin', 'host')
  create(
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: OrgMembershipContext,
    @Body(new ZodValidationPipe(createTeamRequestSchema)) body: CreateTeamRequest,
  ): Promise<Team> {
    return this.teams.create(membership.organizationId, user.userId, body.name);
  }

  @Delete(':teamId')
  @OrgRoles('admin', 'host')
  @HttpCode(204)
  delete(
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: OrgMembershipContext,
    @Param('teamId', new UuidParamPipe()) teamId: string,
  ): Promise<void> {
    return this.teams.delete(membership.organizationId, user.userId, teamId);
  }

  @Post(':teamId/members')
  @OrgRoles('admin', 'host')
  @HttpCode(200)
  addMember(
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: OrgMembershipContext,
    @Param('teamId', new UuidParamPipe()) teamId: string,
    @Body(new ZodValidationPipe(addTeamMemberRequestSchema)) body: AddTeamMemberRequest,
  ): Promise<Team> {
    return this.teams.addMember(membership.organizationId, user.userId, teamId, body.memberId);
  }

  @Delete(':teamId/members/:memberId')
  @OrgRoles('admin', 'host')
  @HttpCode(204)
  removeMember(
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: OrgMembershipContext,
    @Param('teamId', new UuidParamPipe()) teamId: string,
    @Param('memberId', new UuidParamPipe()) memberId: string,
  ): Promise<void> {
    return this.teams.removeMember(membership.organizationId, user.userId, teamId, memberId);
  }
}

@Controller('organizations/:orgId/audit')
@UseGuards(SessionGuard, OrgAccessGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @OrgRoles('admin')
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentMembership() membership: OrgMembershipContext,
    @Query(new ZodValidationPipe(auditListQuerySchema)) query: z.infer<typeof auditListQuerySchema>,
  ): Promise<AuditListResponse> {
    return this.audit.list(membership.organizationId, query.cursor);
  }
}

/** Invitation links are bearer secrets: keep guessing and replay expensive (10/min/IP). */
@Controller('invitations')
@UseGuards(SessionGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('preview')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  preview(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(invitationTokenRequestSchema)) body: InvitationTokenRequest,
  ): Promise<InvitationPreviewResponse> {
    return this.invitations.preview(user, body.token);
  }

  @Post('accept')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  accept(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(invitationTokenRequestSchema)) body: InvitationTokenRequest,
  ): Promise<AcceptInvitationResponse> {
    return this.invitations.accept(user, body.token);
  }
}
