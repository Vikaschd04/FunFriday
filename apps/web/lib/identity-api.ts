import {
  acceptInvitationResponseSchema,
  invitationPreviewResponseSchema,
  type AcceptInvitationResponse,
  type InvitationPreviewResponse,
  addMemberResponseSchema,
  auditListResponseSchema,
  devMailboxResponseSchema,
  meResponseSchema,
  memberListResponseSchema,
  organizationSummarySchema,
  teamListResponseSchema,
  teamSchema,
  type AddMemberRequest,
  type AuditListResponse,
  type CreateOrganizationRequest,
  type CreateTeamRequest,
  type DevMailboxResponse,
  type Member,
  type MemberListResponse,
  type MeResponse,
  type OrganizationSummary,
  type OrgRole,
  type Team,
  type TeamListResponse,
} from '@funfriday/contracts';
import { requestJson, type ApiResult, type RequestOptions } from './http';

export type { ApiFailure, ApiResult, RequestOptions } from './http';

const org = (orgId: string) => `/organizations/${encodeURIComponent(orgId)}`;

export function fetchMe(options?: RequestOptions): Promise<ApiResult<MeResponse>> {
  return requestJson({ ...options, path: '/me', schema: meResponseSchema });
}

export function createOrganization(
  body: CreateOrganizationRequest,
  options?: RequestOptions,
): Promise<ApiResult<OrganizationSummary>> {
  return requestJson({
    ...options,
    method: 'POST',
    path: '/organizations',
    body,
    schema: organizationSummarySchema,
  });
}

export function fetchOrganization(
  orgId: string,
  options?: RequestOptions,
): Promise<ApiResult<OrganizationSummary>> {
  return requestJson({ ...options, path: org(orgId), schema: organizationSummarySchema });
}

export function fetchMembers(
  orgId: string,
  options?: RequestOptions,
): Promise<ApiResult<MemberListResponse>> {
  return requestJson({
    ...options,
    path: `${org(orgId)}/members`,
    schema: memberListResponseSchema,
  });
}

export async function addMember(
  orgId: string,
  body: AddMemberRequest,
  options?: RequestOptions,
): Promise<ApiResult<Member>> {
  const result = await requestJson({
    ...options,
    method: 'POST',
    path: `${org(orgId)}/members`,
    body,
    schema: addMemberResponseSchema,
  });
  return result.kind === 'ok' ? { kind: 'ok', data: result.data.member } : result;
}

export async function changeMemberRole(
  orgId: string,
  memberId: string,
  role: OrgRole,
  options?: RequestOptions,
): Promise<ApiResult<Member>> {
  const result = await requestJson({
    ...options,
    method: 'PATCH',
    path: `${org(orgId)}/members/${encodeURIComponent(memberId)}`,
    body: { role },
    schema: addMemberResponseSchema,
  });
  return result.kind === 'ok' ? { kind: 'ok', data: result.data.member } : result;
}

export function removeMember(
  orgId: string,
  memberId: string,
  options?: RequestOptions,
): Promise<ApiResult<undefined>> {
  return requestJson<undefined>({
    ...options,
    method: 'DELETE',
    path: `${org(orgId)}/members/${encodeURIComponent(memberId)}`,
  });
}

export function fetchTeams(
  orgId: string,
  options?: RequestOptions,
): Promise<ApiResult<TeamListResponse>> {
  return requestJson({ ...options, path: `${org(orgId)}/teams`, schema: teamListResponseSchema });
}

export function createTeam(
  orgId: string,
  body: CreateTeamRequest,
  options?: RequestOptions,
): Promise<ApiResult<Team>> {
  return requestJson({
    ...options,
    method: 'POST',
    path: `${org(orgId)}/teams`,
    body,
    schema: teamSchema,
  });
}

export function deleteTeam(
  orgId: string,
  teamId: string,
  options?: RequestOptions,
): Promise<ApiResult<undefined>> {
  return requestJson<undefined>({
    ...options,
    method: 'DELETE',
    path: `${org(orgId)}/teams/${encodeURIComponent(teamId)}`,
  });
}

export function addTeamMember(
  orgId: string,
  teamId: string,
  memberId: string,
  options?: RequestOptions,
): Promise<ApiResult<Team>> {
  return requestJson({
    ...options,
    method: 'POST',
    path: `${org(orgId)}/teams/${encodeURIComponent(teamId)}/members`,
    body: { memberId },
    schema: teamSchema,
  });
}

export function removeTeamMember(
  orgId: string,
  teamId: string,
  memberId: string,
  options?: RequestOptions,
): Promise<ApiResult<undefined>> {
  return requestJson<undefined>({
    ...options,
    method: 'DELETE',
    path: `${org(orgId)}/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberId)}`,
  });
}

export function fetchAudit(
  orgId: string,
  cursor?: string,
  options?: RequestOptions,
): Promise<ApiResult<AuditListResponse>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return requestJson({
    ...options,
    path: `${org(orgId)}/audit${query}`,
    schema: auditListResponseSchema,
  });
}

/**
 * Local-only dev mailbox. `not_found` means the API has it switched off. Only http(s) links are
 * kept so a message can never put a script URL on the page.
 */
export async function fetchDevMailbox(
  options?: RequestOptions,
): Promise<ApiResult<DevMailboxResponse>> {
  const result = await requestJson({
    ...options,
    path: '/dev/mailbox',
    schema: devMailboxResponseSchema,
  });
  if (result.kind !== 'ok') return result;
  return {
    kind: 'ok',
    data: {
      messages: result.data.messages.map((message) => ({
        ...message,
        links: message.links.filter((link) => /^https?:\/\//i.test(link)),
      })),
    },
  };
}

export function previewInvitation(
  token: string,
  options?: RequestOptions,
): Promise<ApiResult<InvitationPreviewResponse>> {
  return requestJson({
    ...options,
    method: 'POST',
    path: '/invitations/preview',
    body: { token },
    schema: invitationPreviewResponseSchema,
  });
}

export function acceptInvitation(
  token: string,
  options?: RequestOptions,
): Promise<ApiResult<AcceptInvitationResponse>> {
  return requestJson({
    ...options,
    method: 'POST',
    path: '/invitations/accept',
    body: { token },
    schema: acceptInvitationResponseSchema,
  });
}
