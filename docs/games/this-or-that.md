# This or That - Game Spec

Status: implemented in P4 (v1.0, lead-reconciled 2026-10-16 with `packages/contracts/src/games/this-or-that.ts`). Contract source: `docs/GAMES.md` section 1; manifest: `examples/game-manifests/this-or-that.json`. Prompts: `packages/game-core/src/games/this-or-that/content/`.

## Purpose and social goal

A fast, simultaneous either/or poll. Everyone answers at once, then the room sees how it split. The goal is light ice-breaking and spotting shared tastes, not winning. No scores, no ranking, no individual attribution.

## Players and modes

| Item | Value |
|---|---|
| Range | 2-200; default 15-20 (design target until load-tested) |
| `noncompetitive` | Everyone is a player and answers A, B or Pass |
| `audience` | **Later phase** (not in P4): spectators see prompt and reveal but do not vote |
| Breakouts | Host may run the same pack in subrooms; each subroom reveals its own counts |
| Participation | Optional; Pass is always available and never penalized |

## Host config (`configSchema`)

| Field | Range | Default |
|---|---|---|
| `rounds` | 3-10 | 6 |
| `roundSeconds` | 15-60 | 30 |
| `allowAnswerChange` | boolean, fixed before game starts | false |
| `packId` | approved pack | `starter` |
| (seed) | server-generated, never configurable | random per game |

Prompts are drawn without repeats from the pack (seeded, deterministic for tests). Host can preview and skip a prompt before it opens.

## Round state machine

`lobby -> question -> reveal -> (question | finished)`; `paused` overlays `question`.

| From | Trigger | To |
|---|---|---|
| lobby | host `start` (needs >= 2 players) | question (round 1) |
| question | deadline (server time) | reveal |
| question | all connected players answered (incl. Pass) | reveal (early) |
| question | host `closeRound` | reveal |
| question | host `pause` / `resume` | paused / question (deadline extended by paused time) |
| question | host `skip` | next prompt's question, current round not counted |
| reveal | host `next_round` (host-driven, so the group can talk; no auto-advance in P4) | question, or finished if last round |
| any | host `end` or host disconnect > 60 s with timer expiry | finished (server keeps advancing on timers) |

Timers, deadlines and "everyone answered" are server-authoritative. Actions: `voteA`, `voteB`, `pass`; one response per player per round, idempotency key per action.

## What participants see

| Phase | Visible |
|---|---|
| question | Prompt, two large labelled choices plus Pass, own current choice, "N of M answered", countdown (visual + text) |
| paused | "Host paused", timer frozen, own choice kept |
| reveal | Counts and percentages for A, B and Pass, shown as text and bars; own choice highlighted for self only |
| finished | Summary (below) |

Never sent to any client: who chose what, or others' answers before reveal. Spectators get the same redacted view without vote controls. Host sees the same aggregates, never identities.

## End summary (no ranking)

- Most united moment: "18 of 20 picked Sunrise".
- Closest split: "Round 3 was 10 to 10".
- Passes appear only as a room total, never per person.
- Theme highlight: "The room leaned toward quiet over lively".
- Rooms under 5 players: show only counts, no phrasing that could imply who voted how.

## Facilitation tips

- One discussion prompt per round, shown to host only: "Anyone want to share why?", "What would change your pick?", "Who has a favorite story about this?"
- Invite, never call on people by name; speaking is optional.
- Treat the split as a conversation starter; avoid "minority/majority" language.
- Pause on the reveal for a quick reaction or one story, then move on; skip a prompt if it feels off for the room.

## Edge cases

| Case | Behavior |
|---|---|
| Late join | Joins current round, may answer until the deadline; counted in M |
| Disconnect | Answer kept; excluded from "all connected answered" check; rejoin restores own choice and timer |
| Answer after deadline or in reveal | Rejected with `ROUND_CLOSED`, no state change |
| Duplicate vote | Idempotent replay returns the same result; a different vote is rejected unless `allowAnswerChange` |
| Forged/other-room/spectator action | Rejected by server authorization |
| Everyone passes | Reveal shows 0/0 and "Everyone passed"; round is valid, nothing penalized |
| Zero connected | Round times out normally; game can resume when someone rejoins |
| Host leaves | Timers continue; the session host or any organisation Admin can control the room (no automatic transfer in P4) |

## Accessibility

- Two large, labelled buttons (A/B text, not color alone) plus Pass; 44 px minimum targets.
- Keyboard shortcuts 1 = A, 2 = B, 0 = Pass; visible focus, shortcuts listed on screen.
- Timer announced as text at start, 10 s left and close (polite live region); no color-only urgency.
- Reveal is real text ("12 of 20, 60%") with bars as decoration; reduced motion removes animation.
- Camera-off friendly; no voice or video required.

## Privacy and safety

- Persisted: per-round aggregate counts and prompt ids only. Individual answers live in ephemeral room state and are discarded at `finished`.
- No analytics per user; summaries suppress detail in rooms under 5.
- Content: only approved packs (`docs/CONTENT_POLICY.md`); no host free-text in MVP. Custom prompts later must pass length limits and moderation before use.

## Example round

Round 2 of 6, 30 s, 18 connected. Prompt: "Sunrise or sunset?" 14 answer A, 3 answer B, 1 passes in 19 s; early reveal fires on the 18th answer. Reveal: "Sunrise 14 (78%), Sunset 3 (17%), Pass 1 (5%)". Host asks: "Anyone want to share why?"

## Negative-case tests

1. Duplicate `voteA` with a new idempotency key is rejected (`allowAnswerChange` off); same key replays safely.
2. Vote after deadline or during reveal is rejected.
3. Vote from a spectator, non-member or another room is rejected.
4. Malformed action (unknown choice, missing round id, wrong round id) fails Zod validation.
5. Non-host `closeRound`, `skip`, `pause` or `end` is rejected.
6. Client view never contains other players' answers before or after reveal.
7. Reconnect replay restores own choice and does not double-count.
8. Everyone passes and zero-answer rounds reveal cleanly.
9. Pause/resume extends the deadline by exactly the paused time (controlled clock).
10. Pack validation fails on over-length question/options, duplicate options or duplicate ids.
