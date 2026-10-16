# Performance smoke tests

Dependency-free Node scripts (no new packages). Both need a RUNNING API.

## health-load-smoke.mjs (`pnpm test:load`)
HTTP readiness probes, p95 budget 250 ms. See the header of the script.

## live-room-load.mjs (`pnpm test:load:live`)
One live This or That room with N real Socket.IO clients (1 host + N-1 participants).

What it measures (all timestamps taken by the load generator with `performance.now()`):
- connect and `session:join` ack latency (all clients at once)
- `start_game` ack, and start -> every client holds the question view
- all clients answer simultaneously: per-answer ack latency (send -> ack); propagation = send of the
  LAST answer -> each client has the reveal (also max across clients per round)
- `close_round` (round 2, only half the room answers), `next_round`, `end_game`, `end_session` acks and propagation
- correctness: exact reveal counts and answeredCount per round, each client's private `myChoice`,
  all clients end on the same revision with the identical revision sequence, no duplicate/out-of-order
  revisions, skipped revisions are reported, no unexpected disconnects, summary has all rounds.

Exit 1 on any correctness failure or any p95 over budget (ack metrics 250 ms, propagation metrics 500 ms).

### Run
```sh
# 1. API with the dev mailbox on (default in .env.example) and TRUST_PROXY=1, e.g. on a spare port:
cd apps/api && API_PORT=4100 API_PUBLIC_URL=http://localhost:4100 TRUST_PROXY=1 \
  node --enable-source-maps --env-file-if-exists=.env dist/main.js
# 2. Load:
LIVE_LOAD_BASE=http://localhost:4100 pnpm test:load:live
LIVE_LOAD_BASE=http://localhost:4100 LIVE_LOAD_CLIENTS=50 LIVE_LOAD_INFORMATIONAL=1 pnpm test:load:live
```
Env: `LIVE_LOAD_BASE` (default http://localhost:4000), `LIVE_LOAD_ORIGIN` (http://localhost:3000, must be
allow-listed), `LIVE_LOAD_CLIENTS` (20), `LIVE_LOAD_ROUNDS` (5, range 3..10), `LIVE_LOAD_ACK_P95_MS` (250),
`LIVE_LOAD_PROPAGATION_P95_MS` (500), `LIVE_LOAD_INFORMATIONAL` (1 = never fail on budgets).

TRUST_PROXY: every virtual user sends its own `X-Forwarded-For` so per-IP auth limits (5 sign-ups/min/IP)
do not block setup. Without `TRUST_PROXY=1` all users share one IP and setup fails with 429.
Do not use this against a shared or internet-facing deployment.

Data: setup creates synthetic users `load-<run>-*@example.test` and one organisation per run in the API's
database; it does not clean up. Use a disposable database.

### Caveats
- Localhost, single API instance, no network RTT, no TLS/proxy: these numbers are server-side processing
  plus loopback only, not user-perceived latency over the internet.
- Generator and API (plus Postgres/Redis in Docker) share one machine; the generator runs all N sockets in
  one event loop, so its own CPU contention is inside the numbers.
- Not covered: reconnect/deploy failures, long sessions, pause/resume, multiple API instances (Redis adapter
  fan-out), DB/Redis server-side metrics, clients above 50.
