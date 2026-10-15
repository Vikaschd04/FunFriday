# ADR 0001: Architecture Baseline and Foundation Toolchain

- Date: 2026-10-15
- Owner: Lead engineer (Claude Code orchestrator), P0
- Status: **Accepted for P0 scope** (monorepo, toolchain, persistence, HTTP baseline). Realtime ownership, auth provider and deployment target remain open and require their own ADRs (P4, P2, deployment).

## Context and decision drivers

FunFriday needs a premium browser UX, server-authoritative realtime games, tenant-safe data and repeatable local/CI environments. P0 had to turn a documentation kit into a working, tested monorepo without pre-committing decisions that belong to later phases.

## Alternatives considered (cost and tradeoffs)

- **All-in-one Next.js/BaaS** (e.g. Supabase Realtime): faster start, but game authority, room serialization and reconnect snapshots would live in a vendor's model. Rejected for the core; revisit only if P4 proves the custom actor too costly.
- **TypeScript 7 (native)**: rejected for now; `typescript-eslint` 8.71 supports `<6.1`. Re-evaluate when the lint ecosystem supports it.
- **ESLint 9**: officially unsupported. ESLint 10 chosen; Next's bundled react/jsx-a11y/import plugins declare peer `<=9` but were verified to run cleanly under 10 (`pnpm lint` exit 0).
- **Prisma at repo root or in `packages/db`**: rejected. Only the API talks to the database; keeping schema, migrations and the generated client in `apps/api` prevents the web app from importing a DB client and avoids cross-package generated code.
- **ioredis 6.0**: 2.5 months old at decision time; chose the proven 5.11 line. Re-evaluate in P4 together with the Socket.IO Redis adapter.

## Decision

- pnpm 11 workspaces + Turborepo 2; packages `@funfriday/{config,contracts,game-core,ui}`, apps `@funfriday/{web,api}`. Packages are ESM, compiled with `tsc` to `dist/` and consumed via `exports`.
- `apps/api`: NestJS 12 (ESM, legacy decorators + metadata), global prefix `/api/v1`, Zod-validated env, helmet, exact-origin CORS allowlist, request-id correlation, allowlisted error envelope `{code,message,requestId}`, liveness/readiness split.
- Persistence: PostgreSQL 17 via Prisma 7 (`prisma-client` generator, ESM, `@prisma/adapter-pg` driver adapter, `prisma.config.ts`). Schema/migrations/seed in `apps/api/prisma`. DB CHECK constraints hand-added to migrations where Prisma cannot express them.
- Ephemeral: Redis 7 via ioredis with key prefix `ff:`, no offline queue (commands fail fast rather than produce false acknowledgements).
- Shared Zod contracts (`packages/contracts`) are the single source for HTTP shapes; the web client parses every response.
- `packages/game-core` stays transport/DB-free; randomness and time are injected (seeded PRNG, `Clock`).
- Web: Next.js 16 App Router + React 19 + Tailwind 4; design tokens live in `packages/ui` with automated WCAG contrast tests.
- Tests: Vitest 5 (SWC transform for Nest DI metadata), integration tests against real Postgres/Redis using a separate `funfriday_test` database, Playwright + axe-core for E2E, dependency-free HTTP load smoke.
- Supply chain: exact version pins + committed lockfile; pnpm `allowBuilds` allowlist; pnpm minimum-release-age gate honoured, with exclusions only for verified security releases (documented in `pnpm-workspace.yaml`).

## Consequences, performance and security implications

- Two long-running services (web, API). The API must be hosted on a platform that supports persistent WebSockets (decided in a deployment ADR before staging).
- Readiness performs one `SELECT 1` and one Redis `PING` per call; acceptable locally (p95 21.7 ms at 20 concurrent clients) but must be rate-limited/ingress-restricted before public exposure.
- New majors (Next 16, Nest 12, Prisma 7, Vitest 5/Vite 8) carry ecosystem-maturity risk; mitigated by exact pins and full CI coverage.

## Migration, rollback and test strategy

- Migrations are forward-only and additive; `prisma migrate deploy` in CI/staging, never `migrate reset` against shared data.
- Rolling back P0 = reverting the commit; no production data exists.
- Evidence: `docs/phases/P0_FOUNDATION.md` gate report.

## Still open (separate ADRs required)

Auth provider (P2), room ownership/serialization and Socket.IO transport/fallback (P4), scoring time model (P5), deployment target and cost (pre-staging), email provider (P3), brand/trademark.

## Links to relevant tasks/docs

`docs/ROADMAP.md` P0, `docs/TECH_STACK.md`, `docs/ARCHITECTURE.md`, `memory/DECISIONS.md` D001-D002, D010-D014.
