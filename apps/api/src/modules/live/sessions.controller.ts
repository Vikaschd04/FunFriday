import { Body, Controller, Get, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type CreateLiveSessionRequest,
  type JoinByCodeResponse,
  type LiveSessionListResponse,
  type LiveSessionSummary,
  createLiveSessionRequestSchema,
  joinByCodeRequestSchema,
} from '@funfriday/contracts';
import { z } from 'zod';
import type { OrgMembershipContext } from '../../common/http/request-context.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { CurrentUser, SessionGuard } from '../auth/session.guard.js';
import type { SessionUser } from '../auth/auth-session.port.js';
import {
  CurrentMembership,
  OrgAccessGuard,
  OrgRoles,
} from '../identity/interface/org-access.guard.js';
import { SessionsService } from './sessions.service.js';

@Controller('organizations/:orgId/sessions')
@UseGuards(SessionGuard, OrgAccessGuard)
export class OrgSessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  @OrgRoles('admin', 'host')
  @Header('Cache-Control', 'no-store')
  create(
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: OrgMembershipContext,
    @Body(new ZodValidationPipe(createLiveSessionRequestSchema)) body: CreateLiveSessionRequest,
  ): Promise<LiveSessionSummary> {
    return this.sessions.create(
      membership.organizationId,
      membership.membershipId,
      user.name,
      body.title,
    );
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentMembership() membership: OrgMembershipContext): Promise<LiveSessionListResponse> {
    return this.sessions.listOpen(membership.organizationId);
  }
}

/** Room codes are guessable discovery handles: 10 attempts per minute per IP. */
@Controller('sessions')
@UseGuards(SessionGuard)
export class JoinByCodeController {
  constructor(private readonly sessions: SessionsService) {}

  @Post('join-by-code')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  joinByCode(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(joinByCodeRequestSchema))
    body: z.infer<typeof joinByCodeRequestSchema>,
  ): Promise<JoinByCodeResponse> {
    return this.sessions.joinByCode(user.userId, body.code);
  }
}
