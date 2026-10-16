# Consent and Retention Model

Status: model accepted in P2. Implemented incrementally: `Organization.retentionDays` and the audit log exist from P2; consent records arrive with their first consumer (P6 Who Am I).

## Retention defaults

| Data | Default | Where configured | Notes |
| --- | --- | --- | --- |
| Accounts, memberships, teams | Until removed / account deleted | - | Removal cascades team membership |
| Audit log | 365 days | platform default (P8 job) | Ids + action names only, no free text |
| Live game content (captions, guesses, strokes, check-in picks) | `Organization.retentionDays` (default 90) after the session | org setting (Admin, later phase) | Aggregates kept; individual picks for Emoji Check-In are **never** stored per person |
| Session results (aggregates, scores where the game permits) | `retentionDays` | org setting | No individual mood or performance history |
| Live room snapshot (Redis, P4) | 6 hours after the last change (TTL) | platform | Holds per-person answers so reconnects and restarts keep state; never exposed in views, logs or `GameResult`. Redis must be private and access-controlled |
| `GameResult` (P4) | `retentionDays` | org setting | Aggregate counts and highlights only |
| Guest participant rows | Anonymised after `retentionDays` | - | See `GUEST_IDENTITY.md` |
| Dev mailbox messages | 7 days, local only | - | Never enabled in production |
| Event drafts (P1) | Browser storage, user-controlled | - | Moves to the API in P3 |

A scheduled purge job (P8) enforces these; until then the values are recorded and tested at the schema level only.

## Consent records (first used in P6)

`Consent(id, organizationId, subject: membershipId | participantId, eventId?, type, scope, grantedAt, withdrawnAt?)`

| type | Granted when | Withdrawal effect |
| --- | --- | --- |
| `WHO_AM_I_FACT` | Participant submits a fun fact and confirms it may be shown in that event | Before reveal: fact deleted and never shown. After reveal: hidden from results/highlights |
| `HIGHLIGHT_SHARE` | Participant opts in to have a caption/sketch shown in the post-session highlights | Removed from highlights; kept only as an aggregate count |

Rules: consent is per event, never pre-ticked, always withdrawable, and declining is never penalised or visible to others. No consent is needed for anonymous aggregates (vote counts).

## Profile controls

- P2: users can change their display name and sign out of other sessions (account page).
- Later: leave an organisation (P3), delete account with data export (P8 before pilot).
