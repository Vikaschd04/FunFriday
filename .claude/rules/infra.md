---
paths:
  - "infra/**/*"
  - ".github/**/*"
  - "**/Dockerfile"
  - "**/docker-compose*.yml"
---
# Infra and CI Rules

- No hard-coded production secrets; require approval for public deployment.
- Keep separate readiness/liveness health; fail on nonzero status.
- CI must actually run commands that exist, not placeholder passing tasks.
- Verify backup/rollback and websocket-compatible hosting before real usage.
