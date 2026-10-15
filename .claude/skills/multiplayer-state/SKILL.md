---
name: multiplayer-state
description: Implement server-authoritative, serialized realtime game state with Redis snapshots, revisions, reconnection, fair deadlines and duplicate protection.
---

# Realtime state constraints

Source: `docs/ARCHITECTURE.md`, `docs/API_AND_EVENTS.md`. Use room ownership/serialized writes, authoritative deadline and game transitions, validated socket actions, idempotency IDs, monotonic revision, redacted snapshots, bounded outbound data and TTL cleanup. Redis pub/sub adapters are NOT an authority or persistence mechanism. Handle host loss, packet reorder, late join, repeat action, disconnected answer and cross-tenant join. Client timers are cosmetic approximations of server deadlines. Test 2, 5, 20 concurrent clients plus reconnect bursts and rate-limit behavior. No capacity claims without load evidence.
