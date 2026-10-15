# Claude Code Prompts and Agent Delegation Examples

## First-ever kickoff

```text
Read MASTER_PROMPT.md as the master product/development contract. Implement P0 only. Inspect repository state, propose concise plan, assign bounded agents, create working monorepo/frontend/backend/local infra, run actual quality commands, and update project memory with evidence.
```

## Start the next phase

```text
/start-phase P1
```

## Build a game after the room engine exists

```text
/build-game trivia-rush
```

## Have the lead delegate a bounded role

```text
Use the frontend-engineer subagent to implement the responsive event builder in apps/web only. Read docs/DESIGN_SYSTEM.md and event requirements in docs/PRD.md. Do not edit API/schema files. Return changed paths, actual test results and accessibility limitations.
```

## Get independent review and gate

```text
/security-audit current session auth and socket gateway
/quality-gate P4
```

## Save progress and reduce context

```text
/handoff
/cost-aware-workflow
```

## Restart an interrupted session

```text
Read CLAUDE.md, memory/MEMORY.md and memory/STATUS.md. State the current phase, verified tests, blockers and next exact action in under 12 lines. Do not reopen all docs until needed; continue only from the documented phase gate.
```

## Guardrails for prompts

Ask for implementation, not a demo or mockup, when implementation is required. Demand actual test commands/results. Avoid "make everything perfect" as an unverifiable demand; name acceptance conditions and review evidence. Never ask multiple agents to edit a shared contract at once.
