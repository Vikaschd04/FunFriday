---
name: test-engineering
description: Design and run evidence-based automated game, API, Socket.IO, browser, accessibility and multi-client load tests for FunFriday.
---

# Testing discipline

Source: `docs/QUALITY_STRATEGY.md`. Assertions must prove real behavior. Unit-test GameCore transitions; integrate tenant/role denials; run independent Socket clients for concurrency, stale/duplicate actions and rejoin; E2E host/join/play/results on desktop/mobile and browser diversity. Include safe fabricated fixtures. Capture exact command, outcome and logs. Clearly mark NOT RUN checks. Never fudge a passing test by altering assertions without product-owner agreement. QA reports must include unresolved defects, severity and GO/NO-GO.
