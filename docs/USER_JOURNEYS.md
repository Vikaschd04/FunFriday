# User Journeys and Interaction States

## A. Host - Friday Fun Hour

1. Sign in -> team dashboard -> Create FunFriday.
2. Name event; choose timezone/date/time; enter or select invitees; duration 30 min; choose 3 activities; set activity timings.
3. Review session agenda, estimated timing, game capacity, sensitive-content note, and meeting link.
4. Save event, download ICS, send only with configured email provider. Share secure link and short code.
5. Enter lobby; see participants, readiness and network status; start when ready.
6. Run check-in -> guess game -> team trivia; support pause, skip, reveal, reconnection and late join.
7. Finish, show celebration, invite optional appreciation and anonymous enjoyment rating.
8. View aggregate summary and optionally plan another event.

## B. Player - frictionless join

1. Open signed event link -> see title, organizer, meeting time, preview of games.
2. Sign in or enter guest display name under explicit event permission; no unnecessary registration.
3. See brief behavioral code, join lobby, set ready status.
4. Vote, guess, submit or draw; clearly know whether answer registered; see instructions and timer.
5. If disconnected, reconnect without losing identity or creating duplicate score.
6. Celebrate, share optional highlights, rate enjoyment, or leave without further interaction.

## C. New joiner - low-pressure icebreaker

1. Join via invite; camera optional.
2. Select pass or anonymous/text response where personal content is requested.
3. Participate through low-stakes polls and group response reveals.
4. See common interests but never compelled to disclose protected/sensitive attributes.

## D. Group of 50-100

1. Host chooses game with explicit group-size support.
2. Use simultaneous voting/answers or form 5-10 separate teams or subrooms.
3. Avoid a single long serial queue of speakers/drawers.
4. Participant screens prioritize personal actions while the host sees group-wide results.

## Failure, empty and transition states

- No activities: curated recommendations and CTA.
- Event invite expired/revoked: explain why, offer organizer contact, never reveal internal identifiers.
- Room full: clearly state capacity and whether spectator mode is allowed.
- Waiting for host: visible waiting state and optional quiet prompts.
- Host disconnected: grace period, optional handover to cohost, room does not leak authority.
- Player offline: reconnect banner, queued action handling only when semantically safe.
- Round already ended: show closed state; do not silently accept late answers.
- Server error: retain user context and allow safe retry; never duplicate a vote/invitation.
- Session canceled: clear recovery/navigation.

## Design state inventory per screen

| Screen | States to design |
| --- | --- |
| Landing | Default, hover, mobile CTA, reduced motion |
| Dashboard | New workspace, existing events, loading, error |
| Library | Search, filter, no results, card details, capacity warning |
| Event editor | Dirty, invalid, timezone, saving, saved, invite unavailable |
| Lobby | Ready, not ready, waiting, full, kicked, disconnected |
| Game | Loading, instruction, active, submitted, locked, reveal, paused |
| Results | Individual/team, no contest, optional feedback, error |
| Admin | Authorized, permission denied, no members, loading |

## Demo session

Duration 30 min, 20 people: 3 min Emoji Check-In -> 7 min Who Am I -> 12 min Trivia Rush -> 8 min Appreciation & Debrief. Explicitly budget for explanations and transitions. This is a sample, not a rigid duration for all teams.
