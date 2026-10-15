# Phase P0 - Foundation: Plan and Gate Report

- Started: 2026-10-15
- Lead/integrator: main Claude Code session (acting product-architect + devops-engineer for P0)
- Roadmap block: `docs/ROADMAP.md` -> P0

## Outcome (three, max)

1. A pnpm/Turborepo TypeScript monorepo whose `dev`, `build`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e` and `test:load` scripts are real and pass locally and in CI.
2. One end-to-end vertical slice: branded Next.js page -> contract-typed fetch -> NestJS `/api/v1/health/ready` -> live PostgreSQL + Redis checks.
3. Persistence baseline: Prisma 7 schema, first migration, idempotent seed runner; ADR 0001 accepted; memory updated.

Out of scope (later phases): auth, tenancy, events, Socket.IO gateway, games, design-system components beyond P0 tokens.

## Target tree (P0 subset of `docs/PROJECT_STRUCTURE.md`)

```text
package.json  pnpm-workspace.yaml  turbo.json  .nvmrc  .prettierrc.json
apps/api/          NestJS 12 (ESM) - health module, config, Prisma, Redis, error envelope
  prisma/          schema.prisma, migrations/, seed.ts   (see ADR 0001: Prisma lives in apps/api)
apps/web/          Next.js 16 App Router - branded home + live system status
packages/config/   shared tsconfig + ESLint flat configs
packages/contracts Zod schemas: error envelope + codes, health responses
packages/game-core deterministic seeded PRNG + clock primitives (pure)
packages/ui        brand/semantic color tokens (CSS + TS) + WCAG contrast guard tests
infra/             docker-compose (Postgres 17, Redis 7) + test DB init
tests/performance  dependency-free HTTP load smoke (`pnpm test:load`)
.github/workflows/ci.yml
```

## Sequence and ownership

| # | Task | Owner | Depends on |
| --- | --- | --- | --- |
| T1 | Version verification + pinning, workspace root, shared config | lead | - |
| T2 | `packages/contracts`, `packages/game-core`, `packages/ui` tokens + tests | lead | T1 |
| T3 | `apps/web` skeleton (package, Next/TS/ESLint/Playwright config) | lead | T1 |
| T4 | Branded home page + live status panel + e2e spec (`apps/web/app,components,lib,tests`) | `frontend-engineer` | T2, T3 |
| T5 | `apps/api` health/readiness, env validation, error envelope, Prisma + seed, integration tests | lead (backend-engineer role) | T2 |
| T6 | Compose services, CI workflow, load smoke, `.env.example` | lead (devops role) | T5 |
| T7 | Gate: security + accessibility review (read-only, parallel) | `security-reviewer`, `accessibility-reviewer` | T4-T6 |
| T8 | ADR 0001, TECH_STACK versions, STATUS/MEMORY/DECISIONS, gate report | lead | T7 |

T4 runs in parallel with T5/T6 only because paths are disjoint.

## Acceptance checks

- [x] `pnpm install --frozen-lockfile` reproduces from the lockfile (lockfile not yet committed - owner approval).
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` exit 0.
- [x] `pnpm db:up` brings Postgres/Redis healthy; `pnpm db:migrate` + `pnpm db:seed` succeed; seeding twice is idempotent (integration test).
- [x] `GET /api/v1/health/live` 200; `GET /api/v1/health/ready` 200 with both deps up, 503 + `not_ready` when Redis is unreachable (integration test).
- [x] Unknown route returns standard `{code,message,requestId}` envelope (integration test).
- [x] Browser E2E: brand, live "operational" against the real API, keyboard re-check with focus retained, axe clean, no horizontal scroll at 320px.
- [x] `pnpm test:load` runs 400 readiness requests at concurrency 20 with zero errors and reports p50/p95.
- [~] CI workflow written to run the same commands with service containers - **not yet executed on GitHub** (no remote/commit).

## Risks

- Very new majors (Next 16.4, Nest 12 ESM, Prisma 7 driver adapters, Vitest 5/Vite 8) - mitigated by pinning exact versions and verifying build/test locally.
- Decorator metadata under Vitest's transformer (Nest DI) - mitigated with SWC transform for API tests.
- Docker via Colima on the dev machine; CI uses GitHub service containers instead of compose.
- `next/font/google` downloads fonts at build time (network needed in CI).

## Commands

```bash
pnpm install
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:integration && pnpm test:e2e && pnpm test:load
pnpm dev   # web http://localhost:3000, api http://localhost:4000/api/v1
```

## Gate report (QA_REPORT format)

- Date: 2026-10-15, ~20:22-20:24 IST. Environment: macOS 26 (Darwin 25.5, arm64), Node 22.22.0, pnpm 11.20.0, Docker 29.5 via Colima, Postgres 17-alpine + Redis 7-alpine (compose), Chromium 156 (Playwright 1.64.1). Commit: none yet (repo initialised, nothing committed).
- Owners: lead (integration, API, infra, CI); `frontend-engineer` (web page); independent reviewers `security-reviewer`, `accessibility-reviewer` (read-only).
- Final run used `TURBO_FORCE=true` (no cached results).

| Test / command | Result | Evidence | Risk |
| --- | --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | exit 0 | - |
| `pnpm format:check` | PASS | "All matched files use Prettier code style" | - |
| Lint `pnpm lint` | PASS | 8/8 tasks; ESLint 10 incl. Next react/a11y/import plugins | Plugins declare peer eslint <=9 (works; watch upgrades) |
| Typecheck `pnpm typecheck` | PASS | 8/8 tasks, TS 6.0.3 strict | - |
| Unit `pnpm test` | PASS | 83 tests: ui 42, api 19, game-core 9, web 7, contracts 6 | - |
| Build `pnpm build` | PASS | 6/6 tasks; Next static `/`; Nest `dist/` | - |
| Integration `pnpm test:integration` | PASS | 12 tests vs real Postgres (`funfriday_test`) + Redis: readiness up/503-down, envelope, CORS allowlist, request-id, headers, seed idempotency, DB CHECKs | - |
| E2E `CI=1 pnpm test:e2e` | PASS | 7/7 Chromium vs real API+web: brand, operational, keyboard + focus retention, axe WCAG 2.2 AA (serious/critical = 0), 320px, unreachable, reduced motion | Chromium only |
| `pnpm dev` | PASS | API ready 200 + web 200 with brand content | - |
| Load `pnpm test:load` | PASS | 400 req @20 concurrent, p50 6.3 / p95 20.2 / p99 80.6 ms, 0 failures (localhost, prod build) | Not a capacity claim |
| Multi-client realtime | NOT RUN | Socket.IO is P4 scope | - |
| Accessibility review | PASS (no blockers) | H1 focus loss + M1/M2/M3/L1-L3 **fixed**; manual SR/zoom/forced-colors NOT RUN | Manual passes pending (P1) |
| Security review | PASS (no stop-ship) | 2 Medium follow-ups (below); source inspection, not a pen test | - |
| CI on GitHub | NOT RUN | `.github/workflows/ci.yml` written; needs commit + remote | Workflow unproven until first run |
| Kit validator | PASS | `scripts/validate_pack.py` (in isolated venv) | - |

### Defects found and fixed during P0

1. E2E selectors ambiguous with the live region (strict-mode violation) - test fixed (`exact: true`).
2. axe flagged contrast mid-entrance-animation - test now waits for finite animations; settled page passes.
3. Unverified tint colours hard-coded in `globals.css` - moved into `packages/ui` tokens with contrast tests.
4. A11y H1: `disabled` on the focused button risked focus loss - now `aria-disabled`; E2E asserts focus retained.
5. A11y M1: repeat checks could be silent - announcement cleared then set, includes check time; page load announces only problems.

### Open follow-ups (owner, phase)

- **Medium (security, before any public deploy):** `/health/ready` runs DB+Redis per unauthenticated call - add cache/single-flight + rate limit or keep it internal (backend, P1/P2).
- **Medium (security, P2):** CSRF defences (SameSite cookies, Origin/Fetch-Metadata checks, CSRF token) when cookie sessions arrive.
- Low: log redaction/structured logger (P1-P2); web CSP/security headers (P1); pin GitHub Actions to SHAs + Dependabot/Renovate + `pnpm audit` in CI (P1); remove `minimumReleaseAgeExclude` entries once aged out.
- A11y manual: screen reader (VoiceOver/NVDA), 200%/400% zoom, forced colours, Firefox/WebKit E2E projects (P1).

### Gate decision

**GO for P1, conditional on owner review**: all mandatory local checks pass, no critical/high open defects. Conditions: (1) owner approves the initial commit; (2) the first GitHub CI run must pass before P1 work merges. P1 has not been started.
