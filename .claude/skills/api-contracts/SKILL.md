---
name: api-contracts
description: Use validated typed HTTP and Socket.IO contracts with organization-level authorization, stable errors and tenant-safe output shaping.
---

# Shared API and event contract rules

Source: `docs/API_AND_EVENTS.md`, `docs/DATA_MODEL.md`. HTTP `/api/v1`, Zod schema at all network boundaries, namespaced events, clientActionId for mutation, server revision and acknowledgement. Check actor/session/room/round/role/org scope before every state mutation. Client DTOs are redacted by role: don't send answers or facts prematurely. Error format `{code,message,requestId,details?}`; stable enums for invalid/stale/expired/rate-limited actions. API idempotency and migration compatibility must have negative tests. Schema changes owned by a single agent, then consumer and tests updated.
