# Project Status

**As of:** 2026-10-15
**Current phase:** P1 - Premium Design -> **GO for P2** (local + GitHub CI run 38773479161). P2 not started.
**Build status:** All checks pass locally (249 unit, 16 integration, 135 E2E across Chromium/Firefox/WebKit). Code at github.com/Vikaschd04/FunFriday (`main`).

## What works now (try it: `docs/LOCAL_TESTING.md`)

- Landing page, system status page, 404/error/loading states.
- App shell (sidebar / tablet rail / mobile tab bar), dashboard with drafts **saved on this device only**.
- Activity library on real API data (`GET /api/v1/activities`) with search, filters, URL-synced state.
- Event planner: Basics -> Participants -> Activities -> Review, DST-aware times, runtime meter, keyboard reorder, draft save/restore/delete.
- Design system in `packages/ui` (tokens + accessible components, 133 tests); shared contracts for activities, event drafts and time zones.

## Next tasks

1. **Deployment stays deferred (D009):** the owner wanted local testing until there is something usable on the UI - P1 is the first such build. Owner to try `docs/LOCAL_TESTING.md`, then decide whether to raise the deployment ADR now or after more phases.
2. Start P2 (auth, organisations, roles, tenant isolation) via `/start-phase P2` - needs an auth-provider ADR first (managed OIDC vs Auth.js).
3. Carry the P1 follow-ups below.

## Open follow-ups

- Security (P2): nonce-based CSP; rate limiting before org-specific content; CSRF with cookie sessions; readiness probe cache/rate limit before any public deploy; structured logging with redaction.
- A11y manual passes: VoiceOver/NVDA, real 200-400% zoom, Windows forced colours, real Safari.
- UX: unsaved-draft guard on browser Back; `error.tsx` E2E; design nice-to-haves (see P1 gate report).
- Dependency hygiene: audit exception review 2026-11-15; drop overrides/release-age exclusions once upstream catches up.

## Blockers and risks

- None blocking. Disk on the dev machine is tight (~8 GB free); keep >= 4 GB.
- Drafts in browser storage are intentionally temporary until P3 persistence; the UI says so everywhere.
- Brand/trademark unverified; participant caps remain design targets until P4/P8 load tests.

## Last test evidence

`docs/phases/P1_DESIGN_SYSTEM.md` -> Gate report (2026-10-15 22:24-22:27 IST, cache disabled). GitHub CI P1: run 38773479161 (18/18 steps, 3 browsers). P0 evidence: `docs/phases/P0_FOUNDATION.md`; P0 CI run 38758446713.

## Local environment notes

Docker via Colima (`colima start`). `pnpm db:up` / `pnpm db:down`. Ports 3000 web, 4000 API, 5432, 6379 on 127.0.0.1. Playwright browsers: Chromium, Firefox, WebKit installed.

## Handoff

On resume: read `CLAUDE.md`, this file, `docs/phases/P1_DESIGN_SYSTEM.md`, then `docs/ROADMAP.md` P2. Do not start P2 until the owner has reviewed P1 locally.
