---
paths:
  - "apps/api/**/*.ts"
  - "packages/contracts/**/*.ts"
  - "packages/game-core/**/*.ts"
---
# Backend and Game Rules

- Zod at network boundaries; output DTOs must be role/tenant redacted.
- Authorize actor, room, event, round, role and tenant on every operation.
- Domain logic independent from transport and DB; deterministic pure game-core transitions.
- Idempotency keys, revision and atomic room serialization for live actions.
- No client-calculated score, deadline or permission trusted; test duplicates and stale actions.
- Minimize data retention; redact hidden answers, invite tokens and secrets in logs.
