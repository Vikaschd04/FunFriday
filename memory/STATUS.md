# Project Status

**As of:** 2026-10-16
**Current phase:** P2 - Identity, organisations and tenancy -> **GO for P3** (pending first CI run of this commit). P3 not started.
**Build status:** All checks pass locally (320 unit, 158 integration, 207 E2E across Chromium/Firefox/WebKit). Code at github.com/Vikaschd04/FunFriday (`main`).

## What works now (try it: `docs/LOCAL_TESTING.md`)

- Sign-up / sign-in / sign-out with secure cookie sessions; local **dev mailbox** instead of email.
- Organisations with Admin / Host / Participant roles, teams, audit log; members join via **one-time invitation links** (D026).
- Tenant isolation enforced by API guards (404/403) and database composite keys; nonce-based CSP.
- From P1: landing, dashboard, activity library on real data, event planner with drafts saved on this device.

## Next tasks

1. **Deployment stays deferred (D009).** Owner to try the two-person flow in `docs/LOCAL_TESTING.md` section 3a.
2. Start P3 (events + invitations): server-saved events (replacing device drafts), RSVP, ICS export, email adapter (keeping the dev mailbox), password reset, invitation resend.
3. Carry the follow-ups below.

## Open follow-ups

- Security: sign-up account enumeration (library behaviour, rate limited); shared rate-limit storage before scaling; structured logging with redaction; readiness probe limits before any public deploy.
- Product: password reset; invitation resend/revoke; leave organisation; delete account (before pilot).
- A11y manual passes: VoiceOver/NVDA, real 200-400% zoom, Windows forced colours, real Safari.
- Dependency hygiene: audit exception review 2026-11-15; drop overrides/release-age exclusions once upstream catches up.

## Blockers and risks

- None blocking. Dev machine disk is tight (~8 GB free); keep >= 4 GB.
- Better Auth is young (v1 since 2024-11); ADR 0002 keeps it behind `AuthSessionPort` so it can be replaced.

## Last test evidence

`docs/phases/P2_IDENTITY_TENANCY.md` -> Gate report (2026-10-16 10:47-10:52 IST, cache disabled). Earlier: P1 CI run 38773479161, P0 CI run 38758446713.

## Local environment notes

Docker via Colima (`colima start`). `pnpm db:up` / `pnpm db:down`; `pnpm db:migrate` after pulling (P2 added two migrations). Local `.env` needs `AUTH_SECRET` (random), `API_PUBLIC_URL`, `DEV_MAILBOX_ENABLED=true` - see `.env.example`. Ports 3000 web, 4000 API, 5432, 6379 on 127.0.0.1.

## Handoff

On resume: read `CLAUDE.md`, this file, `docs/phases/P2_IDENTITY_TENANCY.md`, `docs/ADRs/0002-authentication-and-tenancy.md`, then `docs/ROADMAP.md` P3.
