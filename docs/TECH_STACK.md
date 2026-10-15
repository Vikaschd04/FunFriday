# Technology Stack and Dependency Policy

**Important:** Specific versions listed here are not pre-pinned. During P0, inspect official release notes and pin compatible stable versions in package manifests/lockfiles. Record verified versions below.

## Core stack

| Layer | Preferred | Reason / caution |
| --- | --- | --- |
| Monorepo | pnpm workspaces + Turborepo | Share typed contracts/components and target CI tasks |
| Frontend | Next.js App Router, React, TypeScript | Excellent web DX, SSR/SEO landing and interactive client game areas |
| Styling | Tailwind CSS + shadcn/ui + Radix primitives | Cohesive adaptable accessible components |
| Animation | Motion, CSS animations | Micro-interactions and reduced-motion alternatives |
| State/data | TanStack Query + local UI state | Explicit server/client separation; do not duplicate Socket room truth |
| API | NestJS / Node.js | Modular enterprise-ready HTTP and Socket.IO adapter ecosystem |
| DTO validation | Zod in shared contracts | Avoid drift in browser, HTTP and socket event shapes |
| Database | PostgreSQL + Prisma | Referential integrity, typed query access and migrations |
| Realtime | Socket.IO | Rooms, broadcasts, acknowledgements, graceful fallback strategies |
| Ephemeral | Redis | Room snapshot, presence, leases, cache and multi-instance adapter |
| Files | S3-compatible storage | Licensed game assets; private retention and upload controls |
| Authentication | Auth provider adapter; select Auth.js/managed OIDC after proof | Start simple; do not roll proprietary auth/crypto; future Entra/Google SSO |
| Tests | Vitest/Jest, Playwright, Supertest, Socket client harness | Rules, API, UI, real concurrent connections |
| Load | k6 or Artillery | Concurrency, room joins, message fanout, endpoint performance |
| Monitoring | Sentry + OpenTelemetry-capable tracing | Errors, transport disconnects, round latency |
| Infra | Docker Compose locally; managed containers for API | Persistent WebSocket hosting, separate web deployment |

## Developer-quality tooling

ESLint, Prettier, TypeScript strict mode, Husky/lint-staged optional, changesets optional, dependency/SBOM audits, CI matrix for lint/type/test/build/Playwright, realistic fixtures and seed scripts.

## Version-lock decisions (recorded P0, 2026-10-15)

Exact versions are pinned in each `package.json`; `pnpm-lock.yaml` is the source of truth.

| Area | Pinned | Notes |
| --- | --- | --- |
| Runtime | Node.js 22.22 (`.nvmrc` = 22, engines `>=22.12`), pnpm 11.20.0 (`packageManager`) | pnpm 11 enforces `allowBuilds` + minimum release age |
| Build | Turborepo 2.11.8, TypeScript **6.0.3** | TS 7.0 rejected: typescript-eslint 8.71 supports `<6.1` |
| Web | Next.js **16.4.1**, React/React DOM 19.3.1, Tailwind CSS 4.3.3, lucide-react 1.57.0 | 16.4.1 fixes critical RCE advisories GHSA-673q-mjm6-r5xr, GHSA-2464-fhr4-w9xw |
| API | NestJS 12.1.3 (ESM), @nestjs/cli 12.0.8, helmet 8.3.0, Zod 4.6.7 | Nest 12 ships ESM only |
| Data | Prisma / @prisma/client / @prisma/adapter-pg **7.10.0**, PostgreSQL 17 (compose/CI image) | npm `latest` tag for prisma is an 8.0 RC; stable 7.10.0 chosen |
| Ephemeral | ioredis 5.11.1, Redis 7 (compose/CI image) | 6.0 deferred to P4 review |
| Lint/format | ESLint **10.12.0**, @eslint/js 10.0.1, typescript-eslint 8.71.2, eslint-config-next 16.4.1, Prettier 3.9.10 | ESLint 9 is unsupported; Next plugins verified working on 10 |
| Tests | Vitest 5.0.4 + Vite 8.3.4, unplugin-swc 2.0.0 + @swc/core 1.16.18, Supertest 7.3.1, Playwright 1.64.1, @axe-core/playwright 4.13.0 | axe 4.14.0 skipped (published same day, no security need) |
| Realtime | Socket.IO - **not installed in P0** | Pin in P4 with room-ownership ADR |

- `pnpm-lock.yaml` committed: [x] (`29ec0f5`)
- Dependency compatibility tested: [x] `pnpm lint/typecheck/test/build/test:integration/test:e2e/test:load` all exit 0 locally and in GitHub CI (see `docs/phases/P0_FOUNDATION.md`)

## Dependency rules

- No `latest` wildcard in production manifests; use reviewed updates and lockfile.
- Prefer built-in primitives to niche animation/rendering dependencies.
- Verify licensing for game media, icon packages and fonts.
- Pin database and Redis major versions in local compose and staging.
- Separate optional features behind flags; remove unused packages promptly.
