# Phase P4 - Realtime Core + This or That: Plan and Gate Report

- Started: 2026-10-16. Lead/integrator: main session. Order changed by owner (D027): games before scheduling.
- Roadmap gates combined: P4 "20-client simple room integration tests pass" + P5's first item "This or That end-to-end".
- Local-first (D009); single API instance (ADR 0003).

## Outcome (the vertical slice)

A Host or Admin presses **Start a live session**, shares a 6-character room code, organisation members join from their own browsers, the lobby shows who is here and ready, the host starts **This or That**, everyone votes on the same prompt against a server deadline, the reveal shows group results (never who chose what), the host moves through rounds, and the session ends with a shareable summary. Refresh or network loss rejoins the same seat with the right state.

## Scope

- **Realtime core**: Socket.IO namespace `/live` on the API, cookie-authenticated handshake with Origin check, one serialized **room actor** per session, revisioned role-redacted views, server deadlines, idempotent actions, Redis snapshots for reconnect/restart, per-socket rate limits.
- **Sessions**: Postgres `LiveSession` + `SessionParticipant` + `GameResult` (aggregate only); HTTP to create, list active, join by code, end.
- **Game engine** in `packages/game-core`: pure `GameDefinition` contract (init, action, host control, timeout, view, summary) with seeded randomness and injected time.
- **This or That**: rules + original, inclusive starter prompt pack; 3-10 rounds; one answer per person per round; Pass always available; aggregate reveal; no ranking.
- **Web**: start/join session, lobby (code, presence, ready), host controls, game screen (two big choices + Pass, accessible timer, live answer count), reveal, summary, reconnect banner.
- **Out of scope**: guests and scheduled events (P3), other games (P5/P6), multi-instance room ownership (deployment ADR).

## Sequence and ownership

| # | Task | Owner | Paths | Depends |
| --- | --- | --- | --- | --- |
| T1 | Plan, ADR 0003, decision D027 | lead | docs | - |
| T2 | Realtime + session contracts (Zod), game-core engine interface + This or That rules + tests | lead (architect role) | `packages/contracts/src/realtime`, `packages/game-core` | T1 |
| T3 | This or That spec + starter prompt pack (original, inclusive, culturally broad) | `game-designer` | `docs/games/this-or-that.md`, `packages/game-core/src/games/this-or-that/content/` | T1 |
| T4 | Realtime gateway, room actor, sessions persistence + HTTP, Redis snapshots, socket integration tests (2/5/20 clients, reconnect, abuse) | `multiplayer-engineer` | `apps/api/**` | T2 |
| T5 | Lobby + game UI + E2E with host and participants in separate browsers | `frontend-engineer` | `apps/web/**` | T4 |
| T6 | 20-client realtime load smoke (vote fan-out latency) | `performance-engineer` | `tests/performance/**` | T4 |
| T7 | Gate reviews: security (socket auth, CSWSH, tenancy, abuse), accessibility (game UI) | reviewers | - | T5 |
| T8 | Fixes, full verification, docs/memory, commit + CI | lead | - | T7 |

## Acceptance checks

- [x] game-core: deterministic tests with fixed seed and clock - one answer per person/round, late answer rejected after deadline, pass counted, pause/resume keeps remaining time, auto-reveal when everyone answered, views never expose who chose what.
- [x] Handshake rejects no session (401), foreign Origin (CSWSH), non-member of the session's organisation (404), ended session.
- [x] Participant cannot send host commands (NOT_HOST); duplicate `clientActionId` returns `duplicate` without re-applying; stale round id returns ROUND_CLOSED.
- [x] 20 real socket clients answer concurrently: every valid unique answer counted exactly once; all clients converge on the same revision.
- [x] Disconnect + reconnect mid-round restores the same seat and `myChoice`; API restart mid-round recovers from the Redis snapshot with the same deadline.
- [x] Redis unavailable -> actions rejected with SERVICE_UNAVAILABLE, never a false "accepted".
- [x] Browser E2E (3 browsers): host + 2 participants in separate contexts play 2 rounds end to end; keyboard-only answering; axe clean; 320px; reduced motion.
- [x] Load smoke: 20 clients, p95 action-ack <= 250 ms and broadcast propagation <= 500 ms on localhost (measured, not claimed).
- [x] All existing checks green locally and in GitHub CI ([run 38887267385](https://github.com/Vikaschd04/FunFriday/actions/runs/38887267385)).

## Risks

- Realtime race conditions -> single serialized actor per room, immutable transitions, revision checks, concurrency tests.
- Cross-site WebSocket hijacking (cookies ride along on WS handshakes) -> Origin allowlist on handshake, tested.
- Fan-out cost with per-viewer redacted views -> measured at 20 clients; deltas only if needed.
- Single-instance assumption -> explicit in ADR 0003; lease-based ownership before any multi-instance deploy.

## Gate report (QA_REPORT format)

- Date: 2026-10-16, final full run 13:37-13:50 IST (`TURBO_FORCE=true`), live E2E re-run after the last copy fix. Environment as P2 plus Socket.IO 4.8.4.
- Owners: lead (plan, ADR 0003, contracts, game engine + This or That rules + room reducer, timing rules, integration, flake root-cause); `game-designer` (spec + 40-prompt pack); `product-designer` (live screens spec); `multiplayer-engineer` (realtime server + 2 fix passes); `frontend-engineer` (live UI + fix pass); `performance-engineer` (load smoke); independent `security-reviewer` and `accessibility-reviewer`.

| Check | Result | Evidence |
| --- | --- | --- |
| Install (frozen) / audit / format / lint / typecheck / build | PASS | all exit 0 |
| Unit | PASS | 407: ui 149, web 138, api 46, game-core 41, contracts 33 |
| Integration (real Postgres + Redis + Socket.IO clients) | PASS | 219 in 17 files: handshake/CSWSH, tenant joins, NOT_HOST, duplicates, 2/5/20 concurrent clients, server deadline via injected clock, reconnect, restart recovery, Redis outage (no false acks), snapshot tampering, sign-out revocation, socket caps, idempotent effects |
| E2E Chromium + Firefox + WebKit | PASS | 219/219 (73 per browser), 0 flaky; live spec re-run 12/12 with retries=0 after the final change |
| Load smoke `pnpm test:load:live` | PASS | 20 clients x3 runs: answer-ack p95 25-33 ms, reveal propagation p95 27-36 ms, exact counts, identical revision sequences; 50 clients (informational) p95 154 / 165 ms |
| Security review | PASS (no stop-ship) | 7 hardening fixes applied with tests |
| Accessibility review | PASS after fixes | 2 High (single-key shortcuts, timing) + 5 Medium fixed; manual screen reader / 200% zoom / forced colours NOT RUN |
| GitHub CI | PASS | [run 38887267385](https://github.com/Vikaschd04/FunFriday/actions/runs/38887267385) on `f684db8`: 23/23 steps (report upload skipped) in 11.5 min, 3-browser E2E + both load smokes |

### Defects found and fixed in P4

1. Removing a host would cascade-delete the organisation's sessions and game results -> `ON DELETE SET NULL (host_membership_id)`; host nullable in the contract.
2. Removed/demoted members kept live access until reconnecting -> immediate socket revocation and live `isHost` refresh.
3. Ghost "connected" members (concurrent joins on one socket; snapshots rehydrated after a restart) could stall auto-reveal -> per-socket join serialization, all members disconnected on load.
4. Redis snapshots trusted on load -> strict schema validation + seed match, otherwise rebuild from Postgres.
5. Sign-out/expired sessions kept live sockets -> 60 s re-validation (always for host commands).
6. Effects (results, session status) could be lost on a crash -> idempotent unique `GameResult` + reconcile on rehydrate.
7. Unbounded sockets/events per user -> caps (5 sockets, 3 per session) and per-user event bucket; join-by-code per-user limit; host check moved inside the room queue.
8. Single-key shortcuts fired window-wide with no off switch (WCAG 2.1.4) -> scoped to the game panel, off switch, host shortcuts removed.
9. Timing fairness (WCAG 2.2.1) -> >= 20 s rounds, answers changeable by default, host +15 s (`extend_round`), pause.
10. Silent phase changes, static titles, injected status regions -> persistent announcer, per-phase titles, persistent status containers.
11. Flaky "join never answers" in parallel E2E: instrumented and measured (0.3-1.1 s lookups at host load avg ~17-20, Postgres in a 2-CPU VM; single 5 s ack) -> client retries a timed-out join once; E2E join expectations 15 s.
12. Small-room reveal claimed "picks stay private" while showing per-option counts (untrue) -> factual sentence; small rooms only drop percentages.
13. Prompt pack: two prompts assumed air travel or physical ability -> replaced.

### Open follow-ups

- Broadcast coalescing before rooms larger than ~50 (full-view fan-out grows ~quadratically; D029).
- Single API instance only (ADR 0003): room-ownership lease + sticky routing before any multi-node deploy; per-user limits are in-process.
- E2E gaps: skip question, reconnect banner states, join-ack retry under delay, API restart mid-round from the browser; Safari tab-walk (2.4.11) unverified; one unreproduced 6 px overflow at 320 px.
- Manual a11y passes (VoiceOver/NVDA incl. NVDA browse-mode vs 1/2/0, 200-400% zoom, forced colours).
- Retention purge job for Redis snapshots/`GameResult` (P8).

### Gate decision

**GO for P5.** Verified locally and in GitHub CI. Real-time This or That is playable end to end by organisation members in separate browsers, server-authoritative and measured; no open critical/high defects. Nothing deployed (D009).
