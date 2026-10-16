# ADR 0003: Realtime Transport and Room Authority

- Date: 2026-10-16
- Owner: Lead engineer (P4)
- Status: **Accepted** for local and single-instance use. Multi-instance ownership must be decided before any multi-node deployment.

## Context

Live games need one source of truth per room: deadlines, accepted answers and reveals must be identical for every participant, survive reconnects, and never double-count. Browsers can't be trusted with time, scores or permissions. The product is local-first (D009) on one API process, but the design must not block scaling later.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| Client-driven state with server relay | Rejected: no authority, trivially cheatable, inconsistent timers |
| Redis as the authority (WATCH/MULTI or Lua per action) | Viable for multi-node, but every game rule would become Redis scripting or optimistic retries; harder to test |
| **In-process room actor + Redis snapshots** | Chosen: one serialized command queue per room runs pure `game-core` rules; Redis holds revisioned snapshots for reconnect/restart |
| Managed realtime (Ably, Pusher, Supabase Realtime) | External service + cost; authority still needs our server; revisit for scale only |

## Decision

1. **Transport**: Socket.IO 4.8 via `@nestjs/platform-socket.io`, namespace `/live`. WebSocket with polling fallback. Max message 16 KB. Every client event is Zod-validated against `packages/contracts/src/realtime` and answered with an ack `{ status: accepted | duplicate | rejected, revision, code? }`.
2. **Handshake security**: the session cookie authenticates via `AuthSessionPort` (ADR 0002). The `Origin` header must be on the `WEB_ORIGIN` allowlist (browsers attach cookies to cross-site WebSocket handshakes - cross-site WebSocket hijacking). Joining a session requires an ACTIVE membership in that session's organisation (otherwise `ROOM_NOT_FOUND`, no existence leak).
3. **Room actor**: one actor per live session holds the authoritative state and processes commands (join, leave, ready, host command, game action, timer) strictly one at a time. Each command computes the next state immutably with `game-core`, **persists the snapshot to Redis, then commits and broadcasts**. If Redis fails, the command is rejected (`SERVICE_UNAVAILABLE`) and state is unchanged - no false acknowledgements.
4. **Views**: after each commit every connected socket receives `room:state { revision, serverNow, view }`, where `view` is computed per viewer by the game's `view()` (role-redacted; This or That never reveals who chose what). Full views, not deltas, while rooms are small; deltas only if load tests demand.
5. **Time**: deadlines are absolute server epoch milliseconds. Clients render countdowns from `deadlineAt` and the skew between `serverNow` and their clock; client timers are cosmetic. The actor schedules one timer for the next deadline; `onTimeout` re-checks `now >= deadline`.
6. **Idempotency**: every mutating event carries a `clientActionId`; the actor remembers recent ids per participant and answers `duplicate` with the current revision without re-applying.
7. **Host authority**: host commands are accepted from the session's host and the organisation's Admins; everyone else gets `NOT_HOST`. No automatic host transfer in P4; the room keeps running if the host drops.
8. **Persistence**: Postgres stores `LiveSession`, `SessionParticipant` and `GameResult` (aggregate counts only). Redis key `ff:room:{sessionId}` stores the latest snapshot (TTL 6 h). On first access after a restart the actor rehydrates from Redis, else from Postgres (lobby).
9. **Abuse limits**: per-socket token bucket (about 10 events/s, burst 20), payload limits, join attempts by code rate-limited per user.

## Consequences

- **Single instance only** until a room-ownership lease (Redis `SET NX PX` per room with fencing tokens) and sticky routing are implemented; the Socket.IO Redis adapter alone does not provide authority. Recorded as a deployment prerequisite.
- Rules stay pure and fully unit-testable with seeded randomness and injected time.
- Per-viewer views cost O(participants) per change; measured in the P4 load smoke.

## Test strategy

Pure rule tests in `game-core`; socket integration tests with 2/5/20 real clients (concurrency, duplicates, late answers, NOT_HOST, cross-org join, CSWSH, reconnect, restart recovery, Redis outage); 3-browser E2E; 20-client load smoke with latency percentiles.
