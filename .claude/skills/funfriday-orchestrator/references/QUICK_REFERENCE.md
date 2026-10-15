# Orchestrator Quick Reference

- Core context: `CLAUDE.md`, `memory/MEMORY.md`, `memory/STATUS.md`.
- Scope: one phase from `docs/ROADMAP.md` at a time.
- Agent task brief: role, phase, owned paths, relevant docs/contracts, acceptance, tests, response format.
- Rules: no overlapping writes, server-authoritative realtime games, consent/tenant checks, no fake integrations, verified tests only.
- Commands: `/start-phase P0`, `/build-game this-or-that`, `/design-feature event-builder`, `/quality-gate P0`, `/security-audit`, `/handoff`.
- Return: GO/NO-GO, actual command evidence, blockers, next 1-3 tasks.
