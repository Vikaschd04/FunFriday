---
name: start-phase
description: Start a named FunFriday roadmap phase with dependency checks, task breakdown, agent ownership, implementation, and evidence-based phase gating.
disable-model-invocation: true
---

# Start phase $ARGUMENTS

1. Read `memory/STATUS.md`, the relevant phase block in `docs/ROADMAP.md`, and only related docs/ADRs.
2. Confirm prerequisite phases and actual repo state. Refuse to pretend missing dependencies exist.
3. Create a short phase plan (outcome, task IDs, changed paths/owners, tests, rollback, risks) and identify the smallest end-to-end vertical slice.
4. Delegate isolated tasks using `docs/ORCHESTRATION.md` task brief; avoid parallel writers in the same paths.
5. Implement and verify the slice, record command outputs; update tests/docs in scope.
6. Run `/quality-gate $ARGUMENTS` only after changes are integrated. Record GO/NO-GO in `memory/STATUS.md`.
7. Stop on critical blockers instead of expanding to the next phase.
