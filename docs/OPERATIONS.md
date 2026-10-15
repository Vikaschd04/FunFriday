# Deployment, Monitoring, Reliability and Rollback

## Environments

- **Local**: Docker Compose DB/Redis plus Node apps.
- **CI**: ephemeral Postgres/Redis, seed tests, lint/type/test/build/e2e smoke.
- **Staging**: isolated credentials/tenants, seeded fictional data, externally reachable browser + socket service.
- **Production**: managed data stores, container host with stable WebSocket connections, CDN/frontend, private secrets, TLS, observability.

## Deployment rules

- Separate Next.js frontend deployments from long-running WebSocket backend instances.
- Use safe migrations with backups, approvals and downgrade procedures.
- Apply rate limits, ingress request limits, connection caps, idle timeouts and network policies.
- Configure secure outbound email domain reputation only when enabled.
- Health endpoints: liveness, readiness and dependency health; don't expose credentials or stack details.
- Use feature flags for new games and AI/third-party integrations.

## Observability

Instrument: room creation/join failures, connected clients, reconnect rate, action acceptance/rejection, server action-ack p50/p95/p99, round state-transition time, room CPU/memory, Redis health, DB pool saturation, error rate, event invitation delivery, frontend user-visible error reports.

Use structured logs with trace/correlation IDs, org/room IDs with suitable minimization, and no secrets or personal content. Dashboards should distinguish auth failures, invalid input and infrastructure issues.

## Release and rollback checklist

- [ ] Staging deploy, smoke test, migration checks.
- [ ] Load test at agreed expected size, plus capacity margin.
- [ ] Feature flags and kill switches verified for high-risk games.
- [ ] DB snapshot/backup and restore rehearsal.
- [ ] Alerts configured for p95 action latency, game failures and disconnect spikes.
- [ ] Rollback tested with compatible DB schema.
- [ ] Incident owner, runbook and escalation contacts assigned.

## Incident examples

- **Game room desync:** freeze unsafe writes, inspect revision mismatch, restore safe snapshot, record incident and root cause.
- **Redis outage:** fail controlled, communicate temporary suspension; no false accepted vote acknowledgements.
- **Calendar provider failure:** keep local event + ICS fallback; do not pretend invitations were delivered.
- **Reported harassment:** stop activity, allow host moderation, preserve only permitted audit evidence for a defined period.

## Backups and retention

Define data retention by class, privacy/legal review, PITR/backup policy, media expiration and deletion/export procedures before handling real corporate employee data.
