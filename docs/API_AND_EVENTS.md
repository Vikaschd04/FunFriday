# HTTP API and WebSocket Event Contracts

## Rules

- Prefix versioned HTTP routes with `/api/v1`.
- Validate all inputs and outputs with schemas in `packages/contracts`; use standardized errors `{code, message, requestId, details?}` and accurate status codes.
- Auth cookies/sessions use secure settings; cross-origin sockets validate origin, credentials/token and membership.
- Socket messages have `{eventId, sessionId, revision, sentAt}` and actor-scoped ack where appropriate.
- Server emits only role-redacted state; do not send answers/clue identities prematurely.
- Use **canonical event names** rather than competing names in different clients.

## HTTP endpoints (target, implement per phase)

| Verb | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/v1/organizations` | Authenticated | Create org |
| GET | `/api/v1/organizations/:id` | Org member | Org summary |
| POST | `/api/v1/teams` | Org admin/host as policy | Create team |
| POST | `/api/v1/invites` | Authorized organizer | Invite org/team member |
| GET | `/api/v1/activities` | Member/guest-safe | Activity catalog |
| POST | `/api/v1/events` | Host | Create scheduled event |
| GET | `/api/v1/events/:id` | Invited/member | Get event and agenda |
| PATCH | `/api/v1/events/:id` | Host | Update future event |
| POST | `/api/v1/events/:id/rsvp` | Invitee | RSVP idempotently |
| POST | `/api/v1/events/:id/invitations/send` | Host | Send through configured outbox, audited |
| GET | `/api/v1/events/:id/calendar.ics` | Invitee | ICS download |
| POST | `/api/v1/events/:id/session` | Host | Create/open live session |
| GET | `/api/v1/sessions/:id` | Authorized | Redacted session snapshot |
| POST | `/api/v1/sessions/:id/feedback` | Participant | Optional end feedback |
| GET | `/api/v1/sessions/:id/summary` | Scoped member | Aggregate session results |

## Realtime namespace / handshake

- Namespace suggestion: `/sessions`; room channel `session:{sessionId}`.
- Join requires valid session-scoped permission token or authenticated event membership; never treat room code alone as permanent access authorization without a restricted guest flow.
- Handshake authenticates; `session:join` attaches actor id and returns snapshot + revision + server time.

## Client -> server events

| Event | Payload essentials | Server ack |
| --- | --- | --- |
| `session:join` | sessionId, inviteToken? | authorized snapshot/revision/time |
| `participant:ready` | sessionId, ready, clientActionId | accepted / revision |
| `game:action` | sessionId, gameId, roundId, actionType, payload, clientActionId | accepted/rejected/duplicate/reason/revision |
| `host:command` | sessionId, command, expectedRevision, clientActionId | newRevision/status |
| `room:resync` | sessionId, afterRevision | role-redacted snapshot |
| `participant:reaction` | sessionId, reaction | ack / throttled |

## Server -> client events

| Event | Semantics |
| --- | --- |
| `room:snapshot` | Complete role-redacted state after join/reconnect |
| `room:state-changed` | Revisioned room state changes |
| `participant:presence` | Real connected count and ready status |
| `game:round-started` | Round id, safe prompt, server deadline, current revision |
| `game:action-received` | Private ack + aggregated public progress as policy allows |
| `game:round-closed` | Submissions locked; no correct answer leak before reveal |
| `game:round-revealed` | Eligible aggregate answers/results |
| `game:score-updated` | Validated scores where game permits |
| `game:completed` | Result and next activity status |
| `session:completed` | Debrief availability |
| `room:error` | Safe machine-readable error, no internal secrets |

## HTTP/Socket error vocabulary

`BAD_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `TENANT_MISMATCH`, `ROOM_NOT_FOUND`, `INVITE_EXPIRED`, `ROOM_FULL`, `NOT_HOST`, `ROUND_CLOSED`, `DUPLICATE_ACTION`, `INVALID_ACTION`, `OUT_OF_SYNC`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`. Canonical list: `packages/contracts/src/errors.ts`. Messages come from a fixed server-side allowlist; exception text is never echoed.

## Implemented (P0)

| Verb | Route | Access | Contract |
| --- | --- | --- | --- |
| GET | `/api/v1/health/live` | Public | `livenessResponseSchema` - process up, no dependency calls |
| GET | `/api/v1/activities` | Public, read-only (global catalog) | `activityListResponseSchema` - display-ordered, `disabled` hidden, no ids/timestamps; `Cache-Control: public, max-age=60` (P1, D017) |
| GET | `/api/v1/health/ready` | Public (restrict at ingress before public exposure) | `readinessResponseSchema` - 200 `ready` / 503 `not_ready`, per-dependency `up`/`down` + latency, no hostnames or errors |

### Identity and tenancy (P2, ADR 0002)

| Verb | Route | Access | Notes |
| --- | --- | --- | --- |
| * | `/api/v1/auth/*` | Public (Better Auth) | sign-up/email, sign-in/email (5/min), sign-out, get-session, send-verification-email, verify-email, update-user, revoke-other-sessions; library error shape `{code,message}` |
| GET | `/api/v1/me` | Session | User + ACTIVE memberships; never joins anything (D026) |
| POST | `/api/v1/invitations/preview` | Session | `{token}` -> org, role, emailMatches, alreadyMember; 404 unknown/used, 410 expired; 10/min |
| POST | `/api/v1/invitations/accept` | Session | `{token}` -> joins; single use; 403 INVITE_EMAIL_MISMATCH, 409 already member, 410 expired; verifies the email; 10/min |
| POST | `/api/v1/organizations` | Session | Creator becomes Admin |
| GET | `/api/v1/organizations/:orgId` | Any member | |
| GET / POST | `/api/v1/organizations/:orgId/members` | Any member / Admin | Emails Admin-only; POST creates INVITED + emails a one-time link (hash stored, 14-day expiry), enumeration-safe; 409 CONFLICT |
| PATCH / DELETE | `/api/v1/organizations/:orgId/members/:memberId` | Admin | 409 LAST_ADMIN |
| GET / POST | `/api/v1/organizations/:orgId/teams` | Any member / Admin, Host | 409 duplicate name |
| DELETE | `/api/v1/organizations/:orgId/teams/:teamId` | Admin, Host | |
| POST / DELETE | `/api/v1/organizations/:orgId/teams/:teamId/members[/:memberId]` | Admin, Host | ACTIVE same-org members only |
| GET | `/api/v1/organizations/:orgId/audit?cursor=` | Admin | 50/page, newest first |
| GET | `/api/v1/dev/mailbox` | Local only | Registered only when `DEV_MAILBOX_ENABLED=true`; refused in production |

Cross-cutting: no session -> 401; non-member / unknown / malformed id -> 404; wrong role -> 403; state-changing requests carrying any cookie need an allow-listed `Origin` (403 otherwise); 300 req/min/IP (health exempt); malformed JSON 400, body over 100 kB 413 (auth routes: 64 KiB, chunked bodies 411); auth: sign-in/sign-up 5/min, send-verification-email 3/min; update-user accepts `name` only.

Every response carries `x-request-id` (caller value kept only if `^[A-Za-z0-9._-]{1,64}$`).

## Ordering, dedupe and acks

- Every mutation has `clientActionId` and server event revision; server returns stable duplicate ack without re-execution.
- Reject actions with invalid room/game/round membership or stale state unless operation is explicitly safe/retryable.
- For reconnect: client asks for snapshot and restores UI from server; no assumption adapter can replay missed packets.
- Delayed packets must not alter completed rounds.
- Domain rules executable in `packages/game-core`; transport only validates, forwards and broadcasts.

## Example contract shape (illustrative)

```ts
const gameActionSchema = z.object({
  sessionId: z.string().uuid(),
  gameId: z.string().uuid(),
  roundId: z.string().uuid(),
  clientActionId: z.string().uuid(),
  actionType: z.enum(['vote', 'answer', 'caption', 'guess', 'stroke', 'pass']),
  payload: z.unknown()
});
```

Define discriminated action-specific payload schemas rather than accepting unknown in production. Never use this illustration as unvalidated production code.
