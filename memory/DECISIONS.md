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
| D009 | Deployment | Containerized API/WebSocket, independent Next.js web | **Owner direction 2026-10-15:** no hosting/deploy work until the initial phases are built and tested locally (multi-browser + multi-client on the dev machine); then choose the target in a deployment ADR. Exact phase cut-off to be agreed. |

## P0 decisions (2026-10-15, lead)

| ID | Topic | Decision | Rationale / revisit |
| --- | --- | --- | --- |
| D001/D002 | Architecture, persistence | **Ratified** for P0 scope in ADR 0001 | Toolchain verified end to end |
| D010 | Toolchain pins | TS 6.0.3 (not 7), ESLint 10, Prisma 7.10.0 stable (not 8 RC), ioredis 5.11 | Ecosystem compatibility; see `docs/TECH_STACK.md` |
| D011 | Prisma location | `apps/api/prisma` + generated client in `apps/api/src/generated` (gitignored) | Only the API may touch the DB; deviates from `docs/PROJECT_STRUCTURE.md` root `prisma/` |
| D012 | Supply-chain policy | Honour pnpm minimum release age; exclusions only for verified security releases, documented inline | next@16.4.1 / react@19.3.1 excluded (critical RCE fixes) |
| D013 | Test DB isolation | Integration tests use `TEST_DATABASE_URL` (`funfriday_test`), refused if equal to `DATABASE_URL` | Never mutate dev data from tests |
| D015 | Source hosting | GitHub `Vikaschd04/FunFriday`, branch `main`; CI = `.github/workflows/ci.yml` | Owner-provided 2026-10-15 |
| D014 | Env loading | Single root `.env` (local only) loaded with `process.loadEnvFile`; real env always wins; Zod-validated, errors name keys never values | No dotenv dependency; production uses secret manager |

## Recorded ADRs

- `docs/ADRs/0001-architecture-baseline.md` - **Accepted for P0 scope**. Auth (P2), room ownership/transport (P4), deployment target remain open.

## How to change a decision

Record date, owner, rationale, alternatives, impact, migration plan. Never overwrite historical rationale with an unexplained one-line replacement. Do not claim a provisional default is deployed.
