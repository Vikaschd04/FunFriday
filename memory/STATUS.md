# Project Status

**As of:** 2026-10-16
**Current phase:** P4 - Realtime core + This or That -> **GO for P5** (pending first CI run of this commit). Order is games-first (D027): next P5 (Emoji Check-In, Trivia Rush), then P6, then P3.
**Build status:** All checks pass locally (407 unit, 219 integration, 219 E2E across Chromium/Firefox/WebKit; 20-client load smoke p95 < 40 ms). Code at github.com/Vikaschd04/FunFriday (`main`).

## What works now (try it: `docs/LOCAL_TESTING.md` section 3c)

- **Live This or That**: Host/Admin starts a session, members join by 6-character code, lobby with presence/ready, server-timed rounds, answers by click or 1/2/0, live answer count, +15 s / pause / close / skip, group-only reveal (never who chose what), summary, reconnect keeps your seat.
- Realtime core: Socket.IO `/live`, per-room serialized actor running pure `game-core` rules, Redis snapshots with validation, restart recovery, idempotent effects, abuse limits (ADR 0003).
- From P2: sign-in, organisations, roles, teams, audit log, invitation links. From P1: landing, library, planner (drafts on device).

## Next tasks

1. Owner tries a live game locally (two browsers).
2. P5: Emoji Check-In (aggregate-only check-in) and Trivia Rush (individual/team, protected answers, scoring) on the same engine.
3. Before rooms > 50 people: broadcast coalescing (D029).

## Open follow-ups

- Live: single instance only (ADR 0003); E2E gaps (skip, reconnect banner, join retry under delay, restart from browser); Safari tab-walk unverified.
- Security: sign-up enumeration (library), shared rate-limit storage before scaling, structured logging, readiness probe limits before public deploy.
- Product: password reset, invitation resend/revoke, leave organisation, delete account.
- A11y manual passes: VoiceOver/NVDA (incl. NVDA browse mode vs 1/2/0), 200-400% zoom, forced colours, real Safari.
- Dependency hygiene: audit exception review 2026-11-15.

## Blockers and risks

- None blocking. Dev machine is resource-tight (8 GB RAM, Postgres in a 2-CPU VM): parallel E2E shows server latency spikes; CI runners are the reference.

## Last test evidence

`docs/phases/P4_REALTIME_THIS_OR_THAT.md` -> Gate report (2026-10-16). Earlier: P2 CI run 38855532097, P1 38773479161, P0 38758446713.

## Local environment notes

Docker via Colima (`colima start`). `pnpm db:up`, `pnpm db:migrate` (use `migrate deploy` semantics: live-session migrations contain a partial index and a column-list FK Prisma can't express - never `migrate dev --create-only` over them without care), `pnpm dev`. Load smokes: `pnpm test:load`, `pnpm test:load:live` (see `tests/performance/README.md`).

## Handoff

On resume: read `CLAUDE.md`, this file, `docs/phases/P4_REALTIME_THIS_OR_THAT.md`, `docs/ADRs/0003-realtime-room-authority.md`, `docs/games/this-or-that.md`, then `docs/GAMES.md` sections 2-3 for P5.
