---
name: quality-gate
description: Conduct the final GO/NO-GO quality gate for a FunFriday phase, including tests, security, accessibility, documentation, and evidence.
disable-model-invocation: true
---

# Quality gate $ARGUMENTS

1. Read current phase acceptance in `docs/ROADMAP.md` and `docs/QUALITY_STRATEGY.md`.
2. Compare repo diff to promised deliverables and run **existing** lint, types, unit, integration, browser, realtime, build checks relevant to scope.
3. Delegate independent QA and security/a11y/performance audits as risk requires.
4. Capture each command, result, reason for any NOT RUN, and link output artifact. Do not claim tests passed if not run.
5. Use `templates/QA_REPORT.md`; list open defects with severity and reproduction.
6. Mark **GO** only when all mandatory checks pass and no high/critical blocking issue remains; otherwise NO-GO with next actions.
7. Update `memory/STATUS.md` and stop before next phase if gate fails.
