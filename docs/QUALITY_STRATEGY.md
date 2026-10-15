# Quality Strategy and Release Gates

## Philosophy

There is no credible guarantee of a zero-defect software product. Our standard is to prevent and detect defects early, test real multi-user behavior, and provide transparent, evidence-backed GO/NO-GO decisions.

## Testing pyramid

1. **Unit** - pure game rules, score calculations, timeouts, vote uniqueness, schema parse, helper functions.
2. **Integration** - DB transaction isolation, authorization, invite issuance/revocation, API persistence, Redis room snapshots, game engine integration.
3. **Realtime multi-client** - 2/5/20 independent Socket.IO clients, event ordering, duplicate action acks, reconnect, host handover, race conditions, hidden answer protection.
4. **Browser E2E** - Playwright on Chromium, Firefox, WebKit for host/participant journeys and responsive viewport coverage.
5. **Visual/a11y** - screenshot diff baselines, axe-like accessibility audits plus manual keyboard/screen reader walkthrough.
6. **Load/fault** - joining floods, 20 concurrent players, 50/100 audience rooms, redis unavailable, API restart, disconnect/rejoin.

## Default quality commands to create in P0

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm build`, and `pnpm test:load`. Agents must not pretend these work before code creates them.

## Evidence rules

For each check record: command, environment, timestamp, summary, result, relevant log/artifact path, known limitations. A test not run is `NOT RUN`, never `PASSED`. Manual observation alone does not replace repeatable tests.

## Critical scenarios

| ID | Test | Gate |
| --- | --- | --- |
| Q01 | Host creates org/event and sends invitation via configured service or ICS fallback | Functional |
| Q02 | Two separate browser clients see same state and take independent actions | Realtime |
| Q03 | 20 real socket clients submit votes concurrently; all valid unique votes counted | Realtime/Load |
| Q04 | Disconnect/rejoin during round restores state; no duplicate score | Resilience |
| Q05 | A participant tries host-only command -> rejected | Security |
| Q06 | Cross-org event/session access -> rejected | Security |
| Q07 | Deadline/late answer/duplicate submit -> consistent server results | Rules |
| Q08 | Trivia answers concealed before reveal | Information leak |
| Q09 | Keyboard-only can start/join/participate; reduced motion respected | Accessibility |
| Q10 | Mobile 320px, tablet and desktop have no clipped game controls | Responsive |
| Q11 | Large room with simulated reconnect/packet burst remains consistent | Performance |
| Q12 | User declines to share Who Am I fact; no reveal/leak | Consent |

## Performance objectives (provisional, test and tune)

- For a 20-person room in representative conditions, **p95 server action-ack latency <= 250 ms** under baseline load, excluding user network RTT, measured and documented separately.
- **p95 propagation <= 500 ms** under representative test network for simple voting events, with environment specified.
- Interactive host flow without severe blocking at 20 concurrent members.
- SLOs for >100 audience participants to be established after first load tests; do not claim large-room support on theory alone.

## Phase gates

- No open P0/P1 security/privacy issue; P2 issues need mitigation and explicit approval.
- No broken MVP core flows, unauthorized room transitions or data isolation defects.
- Relevant automated test/build commands pass; skipped/incomplete checks documented.
- Original game content and consent policies verified.
- Product designer and independent QA sign off on UX/a11y where relevant.
- Deployment and restore practices exercised before any real corporate pilot.

## Handoff format

Use `templates/QA_REPORT.md`. Each phase ends in GO or NO-GO and records the precise failing checks.
