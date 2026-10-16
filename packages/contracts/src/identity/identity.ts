import { z } from 'zod';

/** Organisation roles (D024). Guests are not members (P4, docs/design/GUEST_IDENTITY.md). */
export const orgRoles = ['admin', 'host', 'participant'] as const;
export const orgRoleSchema = z.enum(orgRoles);
export type OrgRole = z.infer<typeof orgRoleSchema>;

/** INVITED = added by email, not yet claimed by a verified account (D022). */
export const membershipStatusSchema = z.enum(['invited', 'active']);
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;

const id = z.uuid();
const isoDate = z.iso.datetime();

/** Lower-cased, trimmed email. Used for sign-up and adding members. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Enter a valid email address.' }).max(254));

export const personNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name.')
  .max(80, 'Keep your name under 80 characters.');

/** Mirrors the API's password policy so the form can explain it before submit. */
export const PASSWORD_POLICY = { minLength: 12, maxLength: 128 } as const;
export const passwordSchema = z
  .string()
  .min(PASSWORD_POLICY.minLength, `Use at least ${PASSWORD_POLICY.minLength} characters.`)
  .max(PASSWORD_POLICY.maxLength, `Use at most ${PASSWORD_POLICY.maxLength} characters.`);

export const orgSlugSchema = z
  .string()
  .max(48)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case');

export const organizationRefSchema = z.object({
  id,
  slug: orgSlugSchema,
  name: z.string().min(1).max(80),
});
export type OrganizationRef = z.infer<typeof organizationRefSchema>;

/** `GET /api/v1/me` - the signed-in user and ACTIVE memberships. Never claims invitations (D026). */
export const meResponseSchema = z.object({
  user: z.object({ id, name: z.string(), email: z.string(), emailVerified: z.boolean() }),
  memberships: z.array(z.object({ organization: organizationRefSchema, role: orgRoleSchema })),
  /** True while the account's email is unverified (informational; joining uses invitation links). */
  needsEmailVerification: z.boolean(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/** `POST /api/v1/organizations` */
export const createOrganizationRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Use at least 2 characters.')
    .max(80, 'Keep the name under 80 characters.'),
});
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;

/** `GET /api/v1/organizations/:orgId` and the create response. */
export const organizationSummarySchema = organizationRefSchema.extend({
  myRole: orgRoleSchema,
  memberCount: z.number().int().nonnegative(),
  createdAt: isoDate,
});
export type OrganizationSummary = z.infer<typeof organizationSummarySchema>;

/** Members are role-redacted: `email` is present for Admin callers only. */
export const memberSchema = z.object({
  id,
  name: z.string().nullable(),
  email: z.string().optional(),
  role: orgRoleSchema,
  status: membershipStatusSchema,
  joinedAt: isoDate.nullable(),
});
export type Member = z.infer<typeof memberSchema>;
export const memberListResponseSchema = z.object({ members: z.array(memberSchema) });
export type MemberListResponse = z.infer<typeof memberListResponseSchema>;

/** `POST /api/v1/organizations/:orgId/members` (Admin). Response never reveals whether an account exists. */
export const addMemberRequestSchema = z.object({ email: emailSchema, role: orgRoleSchema });
export type AddMemberRequest = z.infer<typeof addMemberRequestSchema>;
export const addMemberResponseSchema = z.object({ member: memberSchema });

/**
 * Invitation acceptance (D026, supersedes the auto-claim in D022). Adding a member emails a
 * one-time link to the invited address; joining requires presenting that token while signed
 * in to an account whose email IS the invited address. Holding the inbox (token) and the
 * account (session) together defeats account pre-hijacking. Accepting also verifies the email.
 * Tokens: 32 random bytes, base64url (43 chars), stored hashed, single use, expire after 14 days.
 */
export const INVITATION_TTL_DAYS = 14;
export const invitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'This invitation link is not valid.');
export const invitationTokenRequestSchema = z.object({ token: invitationTokenSchema });
export type InvitationTokenRequest = z.infer<typeof invitationTokenRequestSchema>;

/** `POST /api/v1/invitations/preview` (session). Never reveals the invited address. */
export const invitationPreviewResponseSchema = z.object({
  organization: organizationRefSchema,
  role: orgRoleSchema,
  /** True when the signed-in account's email is the invited address. */
  emailMatches: z.boolean(),
  alreadyMember: z.boolean(),
});
export type InvitationPreviewResponse = z.infer<typeof invitationPreviewResponseSchema>;

/** `POST /api/v1/invitations/accept` (session). 404 unknown/used, 410 INVITE_EXPIRED, 403 INVITE_EMAIL_MISMATCH. */
export const acceptInvitationResponseSchema = z.object({
  organization: organizationRefSchema,
  role: orgRoleSchema,
});
export type AcceptInvitationResponse = z.infer<typeof acceptInvitationResponseSchema>;

/** `PATCH /api/v1/organizations/:orgId/members/:memberId` (Admin). */
export const updateMemberRequestSchema = z.object({ role: orgRoleSchema });
export type UpdateMemberRequest = z.infer<typeof updateMemberRequestSchema>;

export const teamNameSchema = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters.')
  .max(60, 'Keep the team name under 60 characters.');
export const teamSchema = z.object({
  id,
  name: z.string(),
  members: z.array(z.object({ memberId: id, name: z.string().nullable() })),
});
export type Team = z.infer<typeof teamSchema>;
export const teamListResponseSchema = z.object({ teams: z.array(teamSchema) });
export type TeamListResponse = z.infer<typeof teamListResponseSchema>;
/** `POST /api/v1/organizations/:orgId/teams` (Admin, Host). */
export const createTeamRequestSchema = z.object({ name: teamNameSchema });
export type CreateTeamRequest = z.infer<typeof createTeamRequestSchema>;
/** `POST /api/v1/organizations/:orgId/teams/:teamId/members` (Admin, Host). */
export const addTeamMemberRequestSchema = z.object({ memberId: id });
export type AddTeamMemberRequest = z.infer<typeof addTeamMemberRequestSchema>;

export const auditActions = [
  'organization.created',
  'membership.added',
  'membership.claimed',
  'invitation.sent',
  'membership.role_changed',
  'membership.removed',
  'team.created',
  'team.deleted',
  'team.member_added',
  'team.member_removed',
] as const;
export const auditActionSchema = z.enum(auditActions);
export type AuditAction = z.infer<typeof auditActionSchema>;

/** Audit entries carry ids and action names only - never passwords, tokens or free text. */
export const auditEntrySchema = z.object({
  id,
  action: auditActionSchema,
  actor: z.object({ userId: id.nullable(), name: z.string().nullable() }),
  targetType: z.enum(['organization', 'membership', 'team']),
  targetId: id,
  metadata: z.record(z.string(), z.union([z.string().max(120), z.number(), z.boolean(), z.null()])),
  createdAt: isoDate,
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;
/** Query for `GET /api/v1/organizations/:orgId/audit` - `cursor` is opaque (from `nextCursor`). */
export const auditListQuerySchema = z.object({ cursor: z.string().max(200).optional() });
export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

/** `GET /api/v1/organizations/:orgId/audit?cursor=` (Admin), newest first. */
export const auditListResponseSchema = z.object({
  entries: z.array(auditEntrySchema),
  nextCursor: z.string().nullable(),
});
export type AuditListResponse = z.infer<typeof auditListResponseSchema>;

/** Dev mailbox (local only, D022/ADR 0002). `GET /api/v1/dev/mailbox` */
export const devMailSchema = z.object({
  id,
  to: z.string(),
  subject: z.string(),
  text: z.string(),
  /** Absolute links contained in the message, for one-click use in the dev mailbox UI. */
  links: z.array(z.url()),
  createdAt: isoDate,
});
export const devMailboxResponseSchema = z.object({ messages: z.array(devMailSchema) });
export type DevMailboxResponse = z.infer<typeof devMailboxResponseSchema>;

/** `details` shape for BAD_REQUEST validation errors. */
export const validationDetailsSchema = z.object({
  fieldErrors: z.record(z.string(), z.array(z.string())),
});
export type ValidationDetails = z.infer<typeof validationDetailsSchema>;
