# Setup, Installation and First Claude Code Run

## Prerequisites

- Git, Claude Code CLI with a valid account/authentication, a recent supported Node.js LTS, Corepack/pnpm, Docker Compose.
- Editor with TypeScript support (VS Code recommended).
- Later: email provider credentials for real invitations, SSO/calendar credentials for Phase 9 only.

## Before launching Claude Code

1. Unzip starter kit into a new directory. Do not omit the hidden `.claude` folder.
2. In terminal: `cd FunFriday_Claude_Code_Starter` (or rename folder), `git init`, `git status`.
3. Optional local services: `docker compose -f infra/docker-compose.yml up -d` (verify Docker running). This does NOT create the app.
4. `python3 scripts/validate_pack.py` checks documentation/configuration links.
5. `claude --version` and `claude doctor` (if supported) for CLI health.
6. Run `claude` in repository root, ensuring workspace trust and app permissions suit your environment.
7. Prompt: `Read MASTER_PROMPT.md and execute P0; plan briefly, then implement. Verify all claims.`

## Claude Code commands in this kit

- `/funfriday-orchestrator` - short status plus next minimal action.
- `/start-phase P0` - phase implementation plan and actions.
- `/build-game this-or-that` - focused game implementation.
- `/design-feature event-builder` - premium UX spec/implementation workflow.
- `/quality-gate P0` - verify current phase and report blockers.
- `/security-audit` - issue-focused, read-only security pass.
- `/handoff` - update portable memory/progress and resume checklist.
- `/cost-aware-workflow` - compact planning/token discipline.

If a slash command is missing, confirm that `.claude/skills/<name>/SKILL.md` exists and restart from the repo root. Check `/agents` for available agents.

## First Phase 0 commands Claude must create

- pnpm workspace package scripts for dev/build/lint/typecheck/test.
- `apps/web` Next.js dev server and brand home page.
- `apps/api` NestJS health route and working database connectivity.
- Prisma schema and migration/seed task.
- CI tasks that run on pull requests and demonstrate real build/test success.

P0 has created all of the above. Exact commands and prerequisites are in `README.md` -> "Run it locally". Notes:

- `pnpm db:up` uses `scripts/compose.sh`, which picks `docker compose` or standalone `docker-compose`. With Colima, run `colima start` first.
- A first-time Postgres volume also creates `funfriday_test` (via `infra/postgres/init/`). If your volume predates this, create it once: `docker exec funfriday-dev-postgres-1 psql -U funfriday_dev -d funfriday_dev -c 'CREATE DATABASE funfriday_test'`.
- Prisma 7 does not auto-run `generate` or seeding; turbo runs `db:generate` before API build/lint/typecheck/test.
- `pnpm db:migrate` **applies** committed migrations (`prisma migrate deploy`); it never generates or drops anything. To author a new migration use `pnpm --filter @funfriday/api db:migrate:new -- --name <change>` (creates SQL only), then review it: some constraints live only in hand-written SQL (live-session partial unique index on `room_code`, `ON DELETE SET NULL (host_membership_id)`, CHECK constraints) and Prisma may propose dropping them - never commit such drops.
- pnpm 11 blocks dependency build scripts and very new releases by policy; see comments in `pnpm-workspace.yaml` before changing either.
- Allow ~4 GB free disk for dependencies, Playwright Chromium, images and builds.

## Default local service credentials

`infra/docker-compose.yml` has **development-only** example credentials. Replace for shared systems; never reuse them in staging or production. Environment values must not be checked into Git. The local ports are PostgreSQL 5432 and Redis 6379; adjust if occupied.

## Debugging playbook

- App doesn't start: check Node/pnpm compatibility, lockfile, environment template and port conflicts.
- Database not ready: check Compose health and migration log.
- WebSocket fails: check origin/CORS, auth handshake, reverse proxy upgrade and health/status logs.
- Game desync: log room ID, actor ID (non-sensitive), server revision, action ID and deadline; reproduce with 2 clients and load harness.
- Agent not listed: reload Claude Code, check YAML frontmatter and `.claude/agents/` path.

## Sharing this setup

Commit docs, skills, agents, prompt, configs and sample safe fixtures. Do not commit `.env`, local memory with personal data, runtime secrets, database volumes, node_modules or transient test recordings containing personal data.
