# Claude Code Agent Orchestration Playbook

## Orchestrator responsibilities

The primary Claude Code session owns cross-cutting decisions, Git state, phase planning, and final integration. A specialist agent gets an isolated task with clearly bounded scope and returns findings or a patch. Agents are not independent authorities on release readiness.

## Prefer lowest-cost coordination pattern

1. Single main agent when task is short, sequential or needs shared context.
2. Subagent when one independent specialist can solve it and summarize the result.
3. Two parallel subagents only when clearly disjoint files/contracts and no dependency race.
4. Experimental agent teams only for genuine parallel work with coordination, explicit user opt-in and ample token budget. It is disabled by default in this kit.

## Agent ownership matrix (default paths)

| Agent | Primary ownership | Non-editing review of |
| --- | --- | --- |
| `product-architect` | ADRs, contracts review, architecture doc | Whole repo |
| `product-designer` | Product design specs, UI tokens proposals | Frontend UX |
| `frontend-engineer` | `apps/web`, `packages/ui` | API contract consumption |
| `backend-engineer` | `apps/api` HTTP services, `packages/db` or prisma | Domain contracts |
| `multiplayer-engineer` | `apps/api` realtime modules, `packages/game-core` interface | Socket tests |
| `game-designer` | Game manifests and content specs | Mechanics and packs |
| `qa-automation` | `tests/` or test files assigned by lead | All implementation |
| `security-reviewer` | Read-only review report, no source edit | Auth, tenancy, sockets, moderation |
| `accessibility-reviewer` | Read-only audit report | UX, motion, keyboard |
| `performance-engineer` | Load tests and review reports | Socket and infra throughput |
| `devops-engineer` | Infra, CI/CD, environment templates | Production readiness |
| `technical-writer` | Docs, release notes, memory updates when assigned | Changes / ADR traceability |

Resolve path overlaps before delegation: backend and multiplayer must not concurrently edit the same module; frontend and design must not both write component source; QA can write dedicated `tests/` directory while engineering modifies source, but must use stable contracts.

## Standard task brief to pass to each agent

```text
ROLE: <exact agent name>
TASK: <one bounded outcome>
PHASE: P<id>; READ ONLY: <minimal doc paths>
EDIT OWNERSHIP: <explicit exact paths or none>
CONTRACTS: <input/output schemas or relevant ADR>
ACCEPTANCE: <behavior, test names, accessibility/security rules>
DEPENDENCIES: <what must exist before starting>
OUTPUT: changed files, test commands/results, risks, open questions (short)
DO NOT: edit beyond owned paths, deploy, send email, claim passes without evidence
```

## Cross-agent protocol

- Architect proposes/ratifies interfaces before frontend/backend parallel implementation.
- Shared contracts/migrations have **one assigned writer** per task.
- Merge changes after the main agent inspects diff; then QA tests integrated behavior.
- An issue must have reproduction, suspected cause, affected owner and blocking severity.
- New decisions go to `memory/DECISIONS.md` and an ADR if architectural; do not rely on chat messages alone.
- Developer-to-QA contract: expected acceptance scenario, fixture/data needs, test endpoints and auth modes.

## Quality gate protocol

1. Feature agent delivers changes and evidence.
2. QA independently tests; reviewer checks acceptance and regressions.
3. Security/a11y audit for high-risk/changed surfaces.
4. Lead integrates and reruns current gate commands.
5. Write report using `templates/QA_REPORT.md` with PASSED, FAILED, NOT RUN.
6. Gate passes only with no unresolved critical/high blocking defects.
7. Capture handoff in `memory/STATUS.md`; record what must be revisited.

## Progressive context loading

- Always loaded CLAUDE.md stays small (<200 lines).
- Skill descriptions remain short; skill bodies only when invoked.
- Each subagent reads its assigned doc and file regions, not whole repo.
- Use file search or targeted code ranges rather than repeating giant tool outputs.
- `memory/MEMORY.md` is a short index; details in STATUS/DECISIONS/LESSONS.
- Prefer short summaries with exact file paths and changed lines, not full transcribed docs.

## Agent team caveats

Claude Code agent teams are experimental, disabled by default, may have coordination limits and use significantly more tokens. Do not enable the experimental environment flag automatically. For optional evaluation, consult current official docs and obtain explicit approval. Normal subagents already cover this build.
