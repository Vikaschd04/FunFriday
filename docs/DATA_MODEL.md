# Data Model and Multi-Tenancy

Use PostgreSQL + Prisma. The following is a logical schema; the backend agent generates actual SQL/Prisma migrations and tests in P2-P7.

## Main entities

| Table/entity | Keys and fields | Notes |
| --- | --- | --- |
| `User` | id, email?, displayName, avatarRef, createdAt | Guests may need separate session-identity model |
| `Organization` | id, slug, name, settings, retentionPolicy | Tenant root; soft deletion policy |
| `OrganizationMember` | orgId, userId, role, status | Composite unique; scoped RBAC |
| `Team` | id, orgId, name | Org-scoped |
| `TeamMember` | orgId, teamId, userId | Must match org boundary |
| `ActivityDefinition` | id, slug, metadata, manifestVersion | Canonical game types / limits |
| `QuestionPack` | id, orgId?, activityId, locale, reviewStatus, version | Global curated or organization-owned |
| `Event` | id, orgId, hostId, title, startAtUtc, timezone, durationMinutes, status, meetingUrl? | Timezone preserved as IANA ID |
| `EventActivity` | eventId, position, activityId, configJson, durationSeconds | Playlist; ordered unique position |
| `EventInvite` | id, eventId, inviteeEmail?, inviteTokenHash, status, expiryAt | Never store raw reusable invite tokens |
| `Session` | id, eventId, status, startedAt, endedAt, hostId, phase | Room identifier not authorization |
| `SessionParticipant` | id, sessionId, userId?, guestAlias, guestTokenHash?, teamId?, joinedAt | Unique participant identity, reconnect-safe |
| `GameInstance` | id, sessionId, activityId, position, state, config, startedAt, endedAt | One per playlist activity |
| `GameRound` | id, gameInstanceId, roundNo, deadlineAt, status | Server-authoritative deadlines |
| `Submission` | id, roundId, participantId, actionId, normalizedData, submittedAt | Unique `(roundId,participantId)` when one answer per round; action dedup |
| `Score` | id, gameInstanceId, participantId?, teamId?, points | Tally from server rules only |
| `Consent` | id, actorId, eventId?, type, scope, at, withdrawnAt? | Personal-fact/story permission and highlights |
| `SessionFeedback` | id, sessionId, anonymousRating?, comment?, createdAt | Prefer aggregate/anonymous, avoid trackable linkage |
| `AuditLog` | orgId, actorId?, action, targetType, targetId, at | Admin/sensitive operations, retention cap |
| `NotificationOutbox` | id, recipient, provider, type, payloadRef, status, retries | Reliable email integration, no double-send |

## Constraints and indexes

- Include `orgId` for tenant-owned entities or enforce tenant parent joins; validate organization scope for every query and write.
- Composite uniques: org memberships, team memberships, event playlist ordinal, action IDs per actor/round, accepted votes per participant/round.
- Index invites by token hash + expiry, events by `(orgId,startAtUtc)`, sessions by event, submissions by round.
- Store timestamps UTC; display IANA timezone chosen by host; handle DST explicitly.
- Data retention: do not retain raw chat, personality facts, individual check-in selections or canvas strokes longer than necessary without opt-in.
- Migration strategy: backward-compatible expansions with safe rollback plan; never auto-reset production database.

## Separation of persistent and ephemeral state

Postgres holds events, participant rights, canonical game definitions, and completed outcomes. Redis holds current game state, presence, dedup cache, timers/snapshots with TTL. Recovery must be designed, not assumed. Persist milestones according to agreed ADR.

## Sample event state machine

`DRAFT -> SCHEDULED -> LOBBY_OPEN -> LIVE -> COMPLETED`. Alternate `CANCELLED` from pre-completion states; `ABORTED` from LIVE under failure. Disallow illegal transitions in services and database constraints where practical.

## Sample round state machine

`PREPARING -> ACTIVE -> CLOSED -> REVEALED -> FINISHED`; pause uses suspended deadline in authoritative room state, not client-only animation.
