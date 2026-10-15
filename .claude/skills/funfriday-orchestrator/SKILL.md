---
name: funfriday-orchestrator
description: Coordinate phase-wise development of the FunFriday corporate multiplayer team-bonding app in a Claude Code repository. Use when starting work, assigning specialist agents, resuming a phase, or deciding next verified steps and quality gates.
---

# FunFriday orchestration

This skill is the lean project controller. Use it in the repository containing `CLAUDE.md`, `docs/` and `memory/`.

1. Read `memory/MEMORY.md` and `memory/STATUS.md` first, then the current phase in `docs/ROADMAP.md`.
2. Select the smallest working next slice. Follow `docs/ORCHESTRATION.md` for agent ownership and bounded delegation; don't load the full documentation library.
3. Use `.claude/agents/` specialists and skill commands only when their exact job matters. Default to sequential delegation; never allow simultaneous writers on overlapping files.
4. Implement actual behavior with authoritative server state, privacy safeguards, premium inclusive design and tests. Do not fabricate functionality.
5. Run existing commands, record evidence, and use `/quality-gate` before approving the next phase.
6. Update `memory/STATUS.md` and decisions/handoff as relevant. Return a brief status, verified deliverables, blockers, and exact next action.

For a concise quick-reference outside this repository, see `references/QUICK_REFERENCE.md`.
