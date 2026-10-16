# Project Decisions and Pending ADRs

## Provisional defaults (not formally ratified)

| ID | Topic | Provisional direction | Action |
| --- | --- | --- | --- |
| D001 | Architecture | TypeScript pnpm monorepo; Next.js web, NestJS API | Verify compatibility and ADR P0 |
| D002 | Persistence | PostgreSQL/Prisma; Redis ephemeral | Verify migration/ops baseline P0 |
| D003 | Realtime | Socket.IO + authoritative serialized room state | Design room owner/locking strategy in P4 ADR |
| D004 | Auth | Provider abstraction, secure session and guest invites | Select concrete provider in P2 ADR |
| D005 | Video | Use external meeting URLs MVP | Reevaluate post-pilot |
| D006 | Scheduling | ICS + invite link MVP; integrations later | Provider choice for email when approved |
| D007 | Brand | FunFriday provisional working name | Legal/trademark/domain check before public release |
| D008 | Analytics | Aggregate positive engagement, no personnel scoring | Validate with privacy review P2/P8 |
| D009 | Deployment | Containerized API/WebSocket, independent Next.js web | **Owner direction 2026-10-15:** no hosting/deploy work until the initial phases are built and tested locally (multi-browser + multi-client on the dev machine); then choose the target in a deployment ADR. Cut-off confirmed by owner: stay local **until there is something usable on the UI**; revisit deployment at that point. |

## P0 decisions (2026-10-15, lead)

| ID | Topic | Decision | Rationale / revisit |
| --- | --- | --- | --- |
| D001/D002 | Architecture, persistence | **Ratified** for P0 scope in ADR 0001 | Toolchain verified end to end |
| D010 | Toolchain pins | TS 6.0.3 (not 7), ESLint 10, Prisma 7.10.0 stable (not 8 RC), ioredis 5.11 | Ecosystem compatibility; see `docs/TECH_STACK.md` |
| D011 | Prisma location | `apps/api/prisma` + generated client in `apps/api/src/generated` (gitignored) | Only the API may touch the DB; deviates from `docs/PROJECT_STRUCTURE.md` root `prisma/` |
| D012 | Supply-chain policy | Honour pnpm minimum release age; exclusions only for verified security releases, documented inline | next@16.4.1 / react@19.3.1 excluded (critical RCE fixes) |
| D013 | Test DB isolation | Integration tests use `TEST_DATABASE_URL` (`funfriday_test`), refused if equal to `DATABASE_URL` | Never mutate dev data from tests |
| D015 | Source hosting | GitHub `Vikaschd04/FunFriday`, branch `main`; CI = `.github/workflows/ci.yml` | Owner-provided 2026-10-15 |
| D016 | P1 honesty rules | UI without accounts/persistence uses real data only: activities API; builder saves drafts **on this device only**; no create/send/join/sign-in UI until built | `docs/phases/P1_DESIGN_SYSTEM.md` |
| D017 | Activities API pulled forward | Read-only public `GET /api/v1/activities` (global catalog, display order, disabled hidden) in P1 instead of P3 | Real library data; P3 adds detail pages + org content |
| D018 | Dependency security | `pnpm audit --audit-level high` gates CI; overrides mysql2 3.24.5 + deepmerge-ts 8.0.2 (Prisma CLI deps); braces GHSA-vfj7-8cjw-p6xm ignored (no patched release; lint-time only) | Re-check monthly; drop overrides when Prisma updates |
| D019 | CI supply chain | Actions pinned to commit SHAs (checkout v7.0.1, setup-node v7.1.0, pnpm/action-setup v6.1.0, upload-artifact v7.0.2, setup-python v7.0.0); Dependabot for github-actions only | npm updates stay manual under pnpm 11 policies |
| D020 | Web CSP | Baseline CSP + security headers in `next.config.ts`; script/style `'unsafe-inline'` until nonce-based CSP lands with P2 dynamic pages | Tracked P2 |
| D021 | Auth provider | Better Auth 1.7.8 inside the API behind `AuthSessionPort`; email + password; DB sessions; telemetry disabled (ADR 0002) | Revisit before external pilot / SSO need |
| D022 | Adding members | ~~Auto-claim at `/me` for a verified matching email~~ **Superseded by D026** (pre-hijack risk found in security review) | Enumeration-safe add-member response retained |
| D023 | Tenant enforcement | Non-member -> 404, wrong role -> 403; all queries org-scoped; composite FKs keep team members inside their org | API + DB defence in depth |
| D024 | Roles | Admin (members, roles, teams, audit, settings), Host (teams; events in P3), Participant (read); last Admin protected; emails Admin-only | `docs/phases/P2_IDENTITY_TENANCY.md` |
| D025 | Nonce CSP | `apps/web/proxy.ts` issues per-request nonce CSP with 'strict-dynamic'; all pages dynamic; styles keep 'unsafe-inline' (style attributes) | Supersedes D020 for scripts |
| D026 | Invitation acceptance | Adding a member emails a one-time link (32-byte token, hashed, single use, 14-day expiry). Joining requires that token **and** a session for an account whose email is the invited address; accepting verifies the email. `/me` never claims. | Security review 2026-10-15: attacker pre-registering a victim's email cannot claim (has password, not inbox); victim cannot be hijacked (has inbox, not password) |
| D014 | Env loading | Single root `.env` (local only) loaded with `process.loadEnvFile`; real env always wins; Zod-validated, errors name keys never values | No dotenv dependency; production uses secret manager |

## Recorded ADRs

- `docs/ADRs/0001-architecture-baseline.md` - **Accepted for P0 scope**. Auth (P2), room ownership/transport (P4), deployment target remain open.

## How to change a decision

Record date, owner, rationale, alternatives, impact, migration plan. Never overwrite historical rationale with an unexplained one-line replacement. Do not claim a provisional default is deployed.
