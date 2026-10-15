# FunFriday - Product Requirements Document (PRD)

## Core user roles

| Role | Permissions |
| --- | --- |
| Org admin | Org settings, teams, members, event visibility (within policy), aggregate metrics |
| Host | Create/manage own events, invite, configure activities, moderate, control room |
| Participant | Join permitted events, act within active games, opt in/out of contributions |
| Guest | Join by secure invitation, play, view session-only results; no org directory |

All server actions require explicit authorization; client UI hiding is not authorization.

## Scope / priority

### P0/P1 foundation
- Responsive brand shell; high-quality landing and accessibility-ready design system.
- Navigation, state patterns, empty/loading/error/success screens.

### P2 identity and workspace
- Sign-in; org creation; workspace membership; role mapping; team creation.
- Host can invite verified participants; secure guest mode; sessions scoped to organization.
- Consent/retention defaults and profile controls.

### P3 scheduling and discovery
- Game library with playable/non-playable distinctions, search, filters, duration and capacity.
- Event form with title, local date/time/time zone, duration, organizer, participants, game playlist, external meeting URL.
- Event edit, cancel, RSVP, ICS export, copyable join link, invitation delivery adapter.
- Never send email until email transport configured; show explicit send status.

### P4 room orchestration
- Live room code, real-time presence, avatar + ready state; host handover and late arrivals.
- Host-driven start/pause/resume/skip/next with synchronized, monotonic-server-time deadlines.
- Reconnection, participant duplicate session handling, moderation and reporting.

### P5/P6 MVP games
- This or That, Emoji Check-In, Trivia Rush, Who Am I, Caption Clash, Sketch & Guess.
- Each is fully playable in 2+ independent browsers with verified server rules.
- Seed content and consistent game UI; no imported copyrighted question/image sets.

### P7 session wrap
- Game playlists, between-activity intermissions, awards, optional appreciation and feedback.
- Consent-based highlights. Aggregate organization reporting without individual performance metrics.

### P8 release gate
- Accessibility, authorization/security, cross-browser responsiveness, performance, game fairness, operations and pilot.

### P9+ extensions (not MVP)
- Microsoft Graph/Outlook/Teams, Google Calendar/Meet, Slack, SSO/SCIM, recurring schedules, AI packs, advanced collaborative mysteries, native video.

## Required interaction and state rules

1. Every action has clear idle/loading/success/error feedback and does not silently disappear.
2. Participant sees their role, active activity, progress, current deadline and accessible instructions.
3. Participant can opt out or skip nonessential personal questions without penalty.
4. Host can see participant count and genuinely live readiness; disconnections are reported.
5. Answer submission is idempotent and cannot be repeated after closing the round.
6. Only authorized host controls move room/game state.
7. Refresh/rejoin restores the correct room state and replay-protected participant identity.
8. Games with >20 participants use polling/teams/breakouts and do not require one-by-one serial turns.
9. Debrief makes room for non-competitive conversation, not just points.

## Acceptance criteria - core happy path

- Org admin/host signs in and creates a team.
- Host creates Friday Fun Hour, selects at least 2 activities, receives a valid link and `.ics` file.
- 20 simulated connected users and at least 2 real browser sessions independently join the same room.
- Participant joins/rejoins with correct identity and authorization.
- Host starts a game. Client receives the same round deadline and unique answer constraints.
- Results are server-calculated; everyone receives consistent reveal and results.
- Host moves to next game and ends the event.
- Organization sees permitted summary of the session, with no forbidden personal disclosure.

## Exclusions / anti-features

- Do not require corporate SSO for initial local/demo use.
- No manual calendar scheduling disguised as actual third-party calendar API updates.
- No public chat transcripts retained by default.
- No public rankings of introversion, mood, or personality traits.
- No manipulative engagement mechanics, streak pressure or forced camera-on participation.

## Dependencies

Product, UI and game behavior: `docs/DESIGN_SYSTEM.md`, `docs/GAMES.md`, `docs/USER_JOURNEYS.md`.
Architecture and contracts: `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API_AND_EVENTS.md`.
Phases and release criteria: `docs/ROADMAP.md`, `docs/QUALITY_STRATEGY.md`, `docs/SECURITY_PRIVACY.md`.
