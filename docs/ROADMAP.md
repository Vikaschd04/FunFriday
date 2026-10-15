# Roadmap - Phase-Wise Product Delivery

## Working assumptions

Two to three experienced engineers, part-time design/QA and selective specialists. Estimate **16-22 weeks** to reach a pilot-worthy MVP, not a contractual delivery date. Add time for integrations, user testing, procurement, brand legal review and enterprise security. Build only one verified vertical slice at a time.

## Phase matrix

| Phase | Target duration | Primary owner(s) | Goal | Gate |
| --- | --- | --- | --- | --- |
| P0 | 1-2 weeks | architect, devops | Monorepo, dependencies, DB/Redis, baseline CI, hello app/API | `pnpm dev/lint/typecheck/test/build` verified |
| P1 | 1-2 weeks | design, frontend | Design system, landing, app shell, responsive states, motion | Visual + keyboard/reduced-motion review |
| P2 | 2 weeks | backend, security | Authentication, org, role/tenant isolation, team membership | Cross-tenant/role API tests green |
| P3 | 2 weeks | backend, frontend | Event editor, library, invitations, RSVP, ICS, meeting URL | Host can create/share valid session, persistence tests |
| P4 | 2-3 weeks | multiplayer, backend | Lobby, server room actor, timers, presence, reconnect, host ops | 20-client simple room integration tests pass |
| P5 | 2-3 weeks | game, multiplayer, frontend | This or That, Emoji Check-In, Trivia Rush | 3 truly playable games; rule tests + screenshots |
| P6 | 2-3 weeks | game, multiplayer, frontend | Who Am I, Caption Clash, Sketch & Guess | Consent, moderation, strokes/reconnect, 20+ teams |
| P7 | 1-2 weeks | full stack, QA | Playlist, results, feedback, appropriate aggregate analytics | Multi-game E2E flow end-to-end |
| P8 | 2-3 weeks | QA, security, a11y, devops | Load, privacy, UX refinements, pilot, production-readiness | Signed evidence-based GO/NO-GO |
| P9 | after MVP | integrations, architect | Calendar API, recurring events, Teams/Slack, SSO, AI content | Explicit ADR, scoped integration tests |

Some phases can overlap in design/prototyping; dependent implementation steps remain ordered. Do not assume dates until Phase 0 baseline and developer availability are known.

## Definition of Done - every feature

- Requirements and acceptance criteria linked to ticket or `docs/BACKLOG.md`.
- Keyboard, mobile, loading, errors, permissions and telemetry addressed.
- Validated contracts, isolated domain rules, correct type usage.
- Unit and integration tests; E2E for critical user journeys.
- Independent review of risk (auth, privacy, realtime, accessibility).
- Documentation, seed/demo instructions, release notes when user-visible.
- Real command output and GO/NO-GO evidence in handoff.

## Detailed phase checklists

### P0 - Foundation [GO, pending owner review - see docs/phases/P0_FOUNDATION.md]
- [x] Confirm available tools, choose current compatible stable dependency versions, pin lockfile.
- [x] Create pnpm/Turbo monorepo and apps/packages per architecture.
- [x] Start local PostgreSQL and Redis, migrations/seed runner.
- [x] Implement API health/readiness endpoints and branded frontend.
- [x] Environment files/example/secrets policy; CI lint/type/unit/build baseline (CI not yet run on GitHub).
- [x] Prove `pnpm dev`, `pnpm build`, lint, typecheck and smoke test.
- [x] ADR 0001 stack decision (auth provider deferred to P2 ADR); update memory.

### P1 - Premium Design [not started]
- [ ] Tokenize colors/typography/spacing/radii/shadows/icons/motion.
- [ ] Landing hero, product preview, application navigation and dashboard shell.
- [ ] Library card and event builder prototypes with real UI state.
- [ ] Loading/empty/denied/error states; mobile and reduced-motion.
- [ ] Screenshots 320px, tablet and desktop; accessibility walkthrough.

### P2 - Workspace & Auth [not started]
- [ ] Auth/provider selection ADR, login/logout/secure session.
- [ ] Organization, team and membership tables and migration.
- [ ] Roles enforced for API and socket; tenant cross-access tests.
- [ ] Secure guest identity design and token lifecycle.
- [ ] Consent/retention model and audited privileged actions.

### P3 - Events & Invites [not started]
- [ ] Activity library seeded manifests and detail pages.
- [ ] Event create/edit/cancel, agenda, timezone/DST, RSVP and statuses.
- [ ] Secure invite tokens, copy link, room code, ICS export.
- [ ] Email provider adapter / safe no-provider fallback.
- [ ] Playwright host planning journey + API persistence.

### P4 - Realtime Core [not started]
- [ ] Room ownership actor and authoritative state machine ADR.
- [ ] Socket join/leave, presence, ready status, host/c-host controls.
- [ ] Server deadline/time synchronization, idempotent actions, revision.
- [ ] Persistent checkpoints, redacted reconnect snapshots, cleanup.
- [ ] 20-client room smoke tests incl host loss + network drop.

### P5 - Games I [not started]
- [ ] This or That implemented end-to-end (first true vertical slice).
- [ ] Emoji Check-In inclusive, anonymous aggregate behavior.
- [ ] Trivia Rush individual/team, protected answers, scoring/ties.
- [ ] Original safe prompt packs and content versioning.
- [ ] Browser E2E and rules tests for all three.

### P6 - Games II [not started]
- [ ] Who Am I consent/approval/reveal controls.
- [ ] Caption Clash anonymous voting and moderation.
- [ ] Sketch & Guess canvas transport, rate limits, subrooms and reconnect.
- [ ] All modes for 15-20 players work without long idle turns.
- [ ] Visual/a11y and security regression.

### P7 - Orchestration & Reporting [not started]
- [ ] Multi-game playlist runner with flexible transitions/pause/skip.
- [ ] Session result summary and optional appreciation wall.
- [ ] Anonymous enjoyment feedback and aggregate analytics.
- [ ] Graceful errors, late join and event cancellation end-to-end.
- [ ] Full Friday Fun Hour browser journey executed.

### P8 - Hardening and Pilot [not started]
- [ ] Independent security assessment and high-priority fixes.
- [ ] Accessibility audit + manual screen reader/keyboard pass.
- [ ] Load/fault testing at 20, 50, 100 (game-specific) clients.
- [ ] Observability, health checks, backups, restoration and rollback.
- [ ] 3 distinct groups pilot; capture usefulness and safety feedback.
- [ ] GO/NO-GO on explicit evidence, no false 'bug free' claims.

### P9 - Post-MVP [not started]
- [ ] Enterprise user research, SSO/SCIM requirements, procurement review.
- [ ] Outlook/Teams + Google Calendar/Meet integrations, then Slack.
- [ ] Recurring event scheduling and program templates.
- [ ] Optional AI question editor with moderation.
- [ ] Further cooperative games and mobile-specific improvements.

## Sprint planning sequence

At phase start: choose at most three clear outcomes; maintain a small task board in `memory/STATUS.md`. At phase end: run `/quality-gate Px` and `/handoff`. Defects outrank unrelated feature expansion. Never check boxes without evidence.
