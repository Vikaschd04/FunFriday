---
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/*.spec.tsx"
  - "tests/**/*"
---
# Test Rules

- Each test asserts a meaningful contract, not implementation details of animation.
- Favor real server/client interactions and deterministic seeded clock/PRNG for game rules.
- Include negative authorization, duplicate submission, deadline expiry and reconnect.
- Report commands actually executed with results and evidence; don't invent green status.
- Synthetic users only in test fixtures; remove any real personal data.
