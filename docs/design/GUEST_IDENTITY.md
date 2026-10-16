# Guest Identity Design (implemented in P3/P4)

Status: design accepted in P2 (ADR 0002 decision 6). No code yet.

## Who is a guest

Someone invited to **one event** who is not a member of the organisation (contractor, partner, new joiner before onboarding). Guests never get a user account.

## Lifecycle

| Step | Mechanism | Rules |
| --- | --- | --- |
| Invite (P3) | Event invite link carries a random invite token | 256-bit `crypto.randomBytes(32)` base64url; stored only as SHA-256 hash; expires at event end + 2 h; revocable; single event |
| Join (P4) | Invite token -> lobby -> host admits | Rate limit 5 joins/min/IP and 20/min/event; room code alone never grants access |
| Guest session | API issues a guest token, HttpOnly cookie `funfriday.guest` (SameSite=Lax, Secure on https) and Socket.IO handshake auth | New 256-bit token, hashed at rest in `SessionParticipant.guestTokenHash`; TTL = session end + 2 h grace, hard max 24 h |
| Reconnect | Same guest token -> same participant row | No duplicate participants; resync via redacted snapshot |
| End / kick | Token revoked server-side | Kicked guests cannot rejoin the same session without a new admit |
| Retention | Participant row anonymised after `retentionDays` | Display name replaced with "Guest N"; no email ever stored for guests |

## What a guest can and cannot do

- **Can**: join that one session, act in its games, see session-only results, opt out of any personal prompt.
- **Cannot**: list members, teams, other events or the organisation directory; create content outside game actions; access any HTTP route that requires `SessionGuard`.
- Display name: chosen at join, 2-30 characters, trimmed, moderated (P6 filter), shown with a "Guest" badge so guests cannot impersonate members.

## Enforcement

- A separate `GuestSessionPort` (parallel to `AuthSessionPort`) resolves guest tokens; org routes ignore guest cookies entirely.
- Socket handshake accepts **either** a member session (plus event membership) **or** a guest token bound to that session id.
- Tests (P4): guest cannot call org routes (401), cannot join another session (403), expired/revoked token rejected, reconnect keeps identity, token never appears in logs or URLs after join.
