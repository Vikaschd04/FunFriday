# Feature Backlog and Dependencies

| ID | Priority | Phase | Feature | Acceptance owner | Dependencies |
| --- | --- | --- | --- | --- | --- |
| FF-001 | P0 | P0 | Monorepo + CI + local DB/Redis | devops | none |
| FF-002 | P0 | P1 | Tokenized premium responsive design system | designer | FF-001 |
| FF-003 | P0 | P2 | Auth + org + tenant-level RBAC | backend/security | FF-001 |
| FF-004 | P0 | P3 | Create event + playlist + ICS/invite links | backend/frontend | FF-003 |
| FF-005 | P0 | P4 | Secure lobby/presence/host controls | realtime | FF-003, FF-004 |
| FF-006 | P0 | P4 | Authoritative game rules engine and snapshots | realtime | FF-005 |
| FF-007 | P0 | P5 | This or That playable | game/realtime | FF-006 |
| FF-008 | P0 | P5 | Emoji Check-In playable | game/realtime | FF-006 |
| FF-009 | P0 | P5 | Trivia Rush playable | game/realtime | FF-006 |
| FF-010 | P0 | P6 | Who Am I consent + guesses | game/security | FF-006 |
| FF-011 | P0 | P6 | Caption Clash safe captions | game/security | FF-006 |
| FF-012 | P0 | P6 | Sketch & Guess canvas/subrooms | game/performance | FF-006 |
| FF-013 | P0 | P7 | End-to-end session playlist runner | full stack | FF-007..012 |
| FF-014 | P1 | P7 | Feedback + aggregate outcomes | frontend/backend | FF-013 |
| FF-015 | P0 | P8 | Multi-client tests, security/a11y/load and release | QA/security/devops | all MVP |
| FF-016 | P1 | P9 | Outlook/Teams and Google Calendar integrations | integrations | pilot |
| FF-017 | P2 | P9 | Slack/SSO/SCIM/recurring events | integrations | pilot |
| FF-018 | P2 | P9 | Optional AI curated question pack editor | game/security | moderation infrastructure |

`P0` in Priority is critical, not same as Roadmap Phase P0.

## Priority principles

Always choose defect work blocking the active phase before new feature work. A critical security issue blocks release even if design polish is incomplete. High-quality full interactions outperform large catalogs of inactive demo cards.
