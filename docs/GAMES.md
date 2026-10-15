# Game Catalog, Mechanics and MVP Rules

## Content principles

Short rounds; immediate participation for most players; accessibility and opt-out; no identifying/sensitive questions; different cultures and regions; minimal copyrighted materials; no scoring for emotional self-disclosure. Maintain original game content and a question-moderation pipeline.

## MVP game matrix

| ID | Activity | Mode | Range (recommended) | Duration | Phase |
| --- | --- | --- | --- | --- | --- |
| `this-or-that` | This or That | Simultaneous poll, social | 2-200 | 3-8 min | P5 |
| `emoji-check-in` | Emoji Check-In | Noncompetitive group | 2-200 | 2-5 min | P5 |
| `trivia-rush` | Trivia Rush | Individual/team quiz | 2-200 with load test | 8-15 min | P5 |
| `who-am-i` | Who Am I? | Consent-based guessing | 4-30 | 7-12 min | P6 |
| `caption-clash` | Caption Clash | Anonymous captions/voting | 4-100 | 6-12 min | P6 |
| `sketch-and-guess` | Sketch & Guess | Canvas + guessing/rooms | 3-12 per drawing room; breakout at scale | 8-20 min | P6 |

These are **design targets**, not proven platform capacity until load tests pass. Larger sessions split into independent subrooms where game format needs it.

## Shared game contract

Each game has:
- `manifest`: id, display name, format, metadata, capacity, accessibility, assets, age/culture suitability.
- `configSchema`: rounds, timeouts, team/individual mode, question pack, privacy choices.
- `initialise(config, participants, seed)`: deterministic state initialization.
- `onAction(state, actor, action, serverNow)`: authorization + validation, immutable/serialized transition, domain events.
- `onTimeout(state, serverNow)`: authoritative phase progression.
- `selectView(role, state)`: redact secret answers and private submissions.
- `finalize(state)`: results and allowed retained records.

The game core should be a pure rule layer; transport and persistence adapters live outside it. No dependency from `packages/game-core` to React or NestJS.

## 1. This or That

- Hosts choose a safe question pack and 3-10 rounds.
- Every player selects A or B once per round, with a visible pass option.
- Server accepts one response per player/round; keep changes disabled unless option explicitly configured before the round.
- Reveal aggregate results after deadline or early close; host may share prompt for open discussion.
- No ranking. Example: "Coffee or tea?" "City stay or mountain retreat?".
- Test: duplicate submission, late submission, reconnect replay, null response, spectator view.

## 2. Emoji Check-In

- Host selects a fun, non-sensitive prompt (e.g. "Which emoji matches your Friday energy?").
- Players choose 1 emoji from accessible labeled options or pass.
- Aggregate counts only; do not disclose personal mood mappings or store per-user check-ins in analytics.
- Reveal visualization that works for screen readers; no score.
- Test: sensitive telemetry absent, keyboard selection, race at round close.

## 3. Trivia Rush

- Question pack at least 30 curated items for MVP; 8-12 questions per session.
- Four choices, one correct answer, optional category/region filters, clear timer.
- Server does not send correct answer or hidden metadata until reveal.
- Server computes score via `basePoints + cappedSpeedBonus` (exact formula an ADR/config), using server timestamps. Accessibility option for untimed rounds must not penalize participants.
- Support team aggregation and score tie handling; timer expiry triggers reveal on server even if host leaves.
- Test: answer secret exposure, latency manipulation, idempotency, duplicate player identity, score consistency.

## 4. Who Am I?

- Opt-in collection of non-sensitive stories; author approves before session reveal; host can moderate.
- Randomize round order and present clues; players guess person from consenting roster.
- Original contributor may withdraw until publication and can decline to explain their fact.
- Option to use fictional seed profiles in demo. No forcing employees to share hobbies, background or identity information.
- Test: consent withdraw, unauthorized identity reveal, correct person option, host moderation.

## 5. Caption Clash

- Licensed/original safe illustrations displayed to participants; everyone writes a short caption.
- Moderate excessive/abusive content. Show all approved captions anonymously for voting.
- Cannot vote on own caption or submit multiple votes; reveal result after end.
- Avoid requiring users to share personal photos.
- Test: captions never leak authors before reveal, XSS escape, offensive input, length limits, ties.

## 6. Sketch & Guess

- Drawing role rotates; random safe secret prompt known only to current drawer.
- Canvas tools: brush, erase, clear, undo where possible, keyboard-accessible alternative (e.g. descriptive clue / text-based drawing mode).
- Broadcast bounded stroke events rather than full image on each pointer move; resync snapshots for reconnect.
- Server validates guessed answers and timer; drawer cannot submit the secret word.
- Break into 3-12 player drawing rooms, not a 100-user turn-by-turn queue.
- Test: message flood/rate limits, late joins, stroke ordering, reconnection, answer leakage, cleanup.

## Backlog after MVP

- Common Ground Quest (shared interest breakout), Human Bingo, Crowd Consensus, Emoji Decoder, Word Sprint, Story Chain, Team Mystery, Virtual Scavenger Hunt, Build the Impossible, Virtual Tambola, Appreciation Wall, Coffee Roulette, Culture Swap and Show & Tell.
- Prioritize collaboration formats that produce conversation; include noncompetitive activities.

## Content packaging

Game prompts should be versioned seed content with schema validation, difficulty, locale, safety level, optional tags and reviewed attribution. See `docs/CONTENT_POLICY.md`.
