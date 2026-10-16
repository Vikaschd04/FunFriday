# FunFriday - Claude Code Build Kit

**Connect Beyond Work. Play Together. Grow Together.**

This is an implementation blueprint and Claude Code configuration for building a full-stack, real-time corporate team-bonding application. **Phases P0-P2 are implemented**: a pnpm/Turborepo monorepo with a NestJS API and Next.js web app - landing, sign-up/sign-in, organisations with Admin/Host/Participant roles, teams, audit log, activity library and event planner - on PostgreSQL/Redis, with tests and CI. Server-saved events, invitations and live games are **not built yet** (P3-P8). See `memory/STATUS.md`.

**Want to try it?** Follow [docs/LOCAL_TESTING.md](docs/LOCAL_TESTING.md) - setup, what to click, and how to reset.

## Run it locally (after P0)

Prerequisites: Node.js 22.12+, pnpm 11.20+, Docker with Compose (Docker Desktop or Colima).

```bash
pnpm install
cp .env.example .env                 # dev-only sample values
pnpm db:up                           # Postgres 17 + Redis 7 on 127.0.0.1
pnpm db:migrate && pnpm db:seed      # schema + six-activity catalog
pnpm dev                             # web http://localhost:3000, API http://localhost:4000/api/v1
```

Quality commands (all real, all run in CI): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:integration` (needs `pnpm db:up`), `pnpm test:e2e` (first run `pnpm --filter @funfriday/web exec playwright install chromium`), `pnpm test:load` (needs a running API), `pnpm format:check`.

## Start here (5 minutes)

1. Extract this entire folder and keep hidden `.claude/` intact.
2. Install Git, a recent supported Node.js LTS, pnpm via Corepack, Docker, and Claude Code. Verify `claude --version`. Use the latest stable versions compatible with the selected framework versions; pin actual versions during Phase 0.
3. Open a terminal in this directory, initialize Git if necessary (`git init`), and run `claude`.
4. Paste the contents of **`MASTER_PROMPT.md`** as your first Claude Code instruction. Alternatively, type `Read MASTER_PROMPT.md and execute Phase 0 only.`
5. Ask Claude Code to run `/funfriday-orchestrator` for a short status and next-phase plan.
6. Use `/start-phase P0` to execute the first phase, then `/quality-gate P0` before progressing.

**Stop after each phase for a review**; do not try to ship everything in one context window.

## What is included

- `MASTER_PROMPT.md`: master kickoff and orchestration contract.
- `CLAUDE.md`: concise instructions loaded at startup.
- `.claude/agents/`: task-specific subagent definitions (frontend, backend, multiplayer, QA, security, etc.).
- `.claude/skills/`: reusable SKILL.md workflows and technical playbooks.
- `.claude/rules/`: path-scoped coding conventions.
- `docs/`: PRD, UX, architecture, API contracts, roadmap, testing, security, operations, and decisions.
- `memory/`: version-controlled project progress, decisions, handoffs, and lessons.
- `templates/`: feature specs, ADRs, test reports, game specs, and handoffs.
- `examples/game-manifests/`: executable-design examples for the first games, not app code.
- `infra/docker-compose.yml`: optional local PostgreSQL/Redis infrastructure for Phase 0.
- `scripts/validate_pack.py`: static validator for this documentation/configuration kit.

## How Claude Code uses this repository

- **Always loaded:** `CLAUDE.md` (short, durable rules only).
- **On demand:** skills from `.claude/skills/*/SKILL.md`; type `/skill-name` to invoke.
- **Delegated:** specialist agents under `.claude/agents/` use isolated contexts.
- **Portable memory:** `memory/MEMORY.md` explicitly loaded/updated under `CLAUDE.md` rules.
- **Auto memory:** Claude Code also maintains its own machine-local memory. The checked-in `memory/` folder is distinct and does not automatically replace Claude's private auto-memory.

## Non-negotiable delivery rules

- Build end-to-end vertical slices, not disconnected UI mockups.
- Demonstrate actual synchronized multiplayer in independent browser clients.
- Treat timers, scores, permissions, and sensitive answers as server-authoritative.
- Get accessibility, privacy, moderation, and reconnect behavior right from the beginning.
- Never assert "bug-free," "production-ready," or "passed" unless evidence exists.
- Run quality gates after each phase. Update `memory/` before every handoff.

## Suggested first milestone

A real host can create a session, invite 20 connected participants, run **This or That**, and see live results from multiple devices. Expand to Trivia Rush, Emoji Check-In, Who Am I, Caption Clash, and Sketch & Guess afterward.

## Useful references

Official Claude Code instructions and current docs are linked in `docs/REFERENCES.md`. Detailed startup actions are in `docs/SETUP.md`.
