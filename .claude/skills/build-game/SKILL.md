---
name: build-game
description: Implement and test a specific FunFriday multiplayer activity end to end, from game manifest and rules through Socket.IO and UI.
disable-model-invocation: true
---

# Build game $ARGUMENTS

Load the selected game section from `docs/GAMES.md`, the common rules in `docs/API_AND_EVENTS.md`, `docs/ARCHITECTURE.md`, and current phase.

1. Use `game-designer` to confirm mechanic, content safety, player ranges, score/no-score, consent and edge cases.
2. Assign ONE owner to shared contracts and GameCore state transitions; implement deterministic pure rules first with fake clocks and seeded randomization.
3. Integrate with authoritative serialized room state/Socket actions. Never leak hidden prompts or trust browser scores.
4. Build accessible responsive participant + host UI using shared design tokens.
5. Run 2-client E2E, 20-client concurrency/sync tests, reconnect and duplicate/late action tests, plus security/a11y checks.
6. Return actual evidence, changed paths, regressions and gameplay limitations. Do not mark ready without a playable cross-client demo.
