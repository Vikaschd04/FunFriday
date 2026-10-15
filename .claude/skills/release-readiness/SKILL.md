---
name: release-readiness
description: Prepare repeatable FunFriday local/CI/staging/production operations with websocket health, observability, backup and rollback checks.
---

# Release and DevOps conventions

Source: `docs/OPERATIONS.md`. WebSockets require appropriate long-running service; frontend can deploy separately. Set up dependency health, secure env sample, DB/Redis migration/backup strategy, CI that actually runs lint/type/unit/build/E2E, version pins and lockfiles. Use secret manager in shared environments and feature flags for risky games. Measure room fanout and disconnects, configure alerts and rollback. Never publish or spend money without approval, and never call app production-ready from a local build alone.
