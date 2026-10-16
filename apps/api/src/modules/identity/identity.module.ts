import { Module } from '@nestjs/common';
import { AuditService } from './application/audit.service.js';
import { InvitationsService } from './application/invitations.service.js';
import { MembersService } from './application/members.service.js';
import { OrganizationsService } from './application/organizations.service.js';
import { TeamsService } from './application/teams.service.js';
import {
  AuditController,
  InvitationsController,
  MeController,
  MembersController,
  OrganizationsController,
  TeamsController,
} from './interface/identity.controllers.js';
import { OrgAccessGuard } from './interface/org-access.guard.js';

@Module({
  controllers: [
    MeController,
    OrganizationsController,
    MembersController,
    TeamsController,
    AuditController,
    InvitationsController,
  ],
  providers: [
    AuditService,
    OrganizationsService,
    MembersService,
    TeamsService,
    InvitationsService,
    OrgAccessGuard,
  ],
})
export class IdentityModule {}
