# FunFriday - Permanent Project Instructions

You are the engineering lead building FunFriday, a corporate team-bonding and realtime multiplayer web app. Follow the project documents; make working changes, not fake demos.

## Read first, then selectively

1. On every fresh session read `memory/MEMORY.md` and `memory/STATUS.md`; inspect Git status and the current phase. Do not load all docs.
2. On a new task, read only relevant sections of `docs/ROADMAP.md`, `docs/ORCHESTRATION.md`, `docs/PRD.md`, the matching implementation document, and any referenced ADR.
3. `MASTER_PROMPT.md` is the initial project kickoff, not a permanent prompt to paste every turn.
4. If a requirement changes, update docs and `memory/DECISIONS.md` rather than silently changing scope.

## Product priorities

- Human connection > vanity engagement. Playful, premium SaaS UI; never childish or cluttered.
- Default experience: 15-20 people; allow 2-10 and larger rooms via game-specific limits and team/audience formats.
- WCAG 2.2 AA where applicable, keyboard access, reduced motion, camera-off, skip/pass options, text alternatives.
- No employee performance ranking, no sensitive disclosures, no HR individual mood dashboards.
- Keep all marketing/demo data clearly marked as fictional.

## Architecture decisions

- Monorepo: pnpm + Turborepo; `apps/web` (Next.js/React/TypeScript), `apps/api` (NestJS/TypeScript), `packages/ui`, `packages/contracts`, `packages/game-core`, `packages/config`.
- PostgreSQL + Prisma; Redis for ephemeral rooms/presence; Socket.IO realtime transport.
- Validate HTTP and Socket.IO actions using shared Zod contracts; enforce RBAC/tenant checks on server.
- Server-authoritative state, time, scores, submissions. Use room ownership/serialization and idempotency keys.
- Design auth as a provider adapter; start with managed or framework-standard auth and build SSO/SCIM later if commercially needed.
- Never put credentials in Git. Use a documented `.env.example` and runtime secret storage.

## Working method

1. Choose the next unchecked item in `docs/ROADMAP.md`; respect dependencies.
2. Write/refresh an acceptance-oriented plan before material changes.
3. Delegate bounded tasks to named `.claude/agents/` specialists. Give each a file ownership boundary, inputs, acceptance criteria, and concise expected handoff. Prefer sequential subagents when files overlap.
4. Implement the smallest working end-to-end vertical slice. Add tests before or with changes; never claim a test ran unless you saw its output.
5. Run the commands that actually exist in the repo; if blocked, report exact reason and the missing validation.
6. Independent QA, security, and accessibility review at release gates. Fix critical defects before a phase passes.
7. Update `memory/STATUS.md`, `memory/DECISIONS.md` (only for new decisions), and `memory/MEMORY.md` index. Summarize changed files, commands run, evidence, blockers, and next tasks.

## Agent/model/token discipline

- Main Claude instance is the orchestrator, not all specialists simultaneously.
- Spawn focused subagents for independent tasks; parallel agents must not edit the same files.
- Use `.claude/skills` on demand; do not paste entire docs into every agent prompt.
- Review and test high-risk changes; avoid repetitive documentation rewrites and unnecessary full-file dumps.
- Experimental agent teams are optional and expensive; default to regular subagents unless clearly justified.

## Commit and release hygiene

- No destructive commands, credential changes, public deployments, purchases, or external invitations without explicit approval.
- No false green checks. Separate `verified`, `unverified`, and `blocked` in QA and handoffs.
- ADRs for irreversible design choices; maintain minimal compatible migrations.
- Keep this file short. Detailed standards live in `docs/` and `.claude/rules/`.
