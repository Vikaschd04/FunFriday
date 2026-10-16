# Durable Engineering Learnings

Only add reproducible, cross-session knowledge that saves future work. No redundant code summaries, user data, credentials or long chat transcripts.

## Initial design lessons

- Browser-first and bring-your-own-meeting-link avoids building a video platform prematurely.
- True 20-user participation must be tested with multiple independent clients; a single client UI demo is insufficient.
- The Socket.IO Redis adapter handles multi-node broadcasts but is not a substitute for a serialized room actor, persisted state or authoritative reconnect snapshots.
- Host controls require backend role checks; room codes alone should not grant privileged access.
- Game library size is not the value proposition; shared conversation and comfortable social engagement are.

## P0 learnings (2026-10-15)

- 2026-10-15 | pnpm install exited 1 with no output | `ENOSPC` only visible when output was redirected to a file | Check `df -h` first when a tool fails silently | P0 setup
- 2026-10-15 | pnpm 11 install | Fails on unapproved build scripts and on packages younger than its minimum release age | Use `allowBuilds` in `pnpm-workspace.yaml`; exclude only verified security releases; stale `node_modules/.pnpm/lock.yaml` keeps old resolutions - `pnpm clean --lockfile` | `pnpm-workspace.yaml`
- 2026-10-15 | npm `latest` tags | `typescript@latest` = 7.0 (breaks typescript-eslint), `prisma@latest` = 8.0 RC | Never trust `latest`; check dist-tags and peer ranges | `docs/TECH_STACK.md`
- 2026-10-15 | axe contrast failures on correct tokens | axe sampled text mid fade-in animation | Wait for finite `document.getAnimations()` before axe | `apps/web/tests/e2e/home.spec.ts`
- 2026-10-15 | Nest DI under Vitest | Vite's transformer emits no decorator metadata | Use unplugin-swc with `decoratorMetadata` | `apps/api/vitest.shared.ts`
- 2026-10-15 | Playwright `getByText` strict-mode failures | sr-only live region repeats visible status text | Use `exact: true` or role-scoped locators | E2E specs

## P1 learnings (2026-10-15)

- 2026-10-15 | "no horizontal scroll" E2E passed while a 320px row was unreadable | Narrow flex rows squeezed notices to ~110px | Pair reflow assertions with minimum content-width checks (e.g. notice >= 240px) and lead screenshot review | builder E2E
- 2026-10-15 | Prisma `migrate dev --create-only` on a populated table | Required columns without defaults fail | Hand-edit to add-nullable, backfill, then SET NOT NULL | `apps/api/prisma/migrations/*_activity_category_and_order`
- 2026-10-15 | `rejects.toThrow()` kept passing after a schema change | Failure reason changed from DB CHECK to missing field | Assert the specific constraint/error, not just "throws" | `apps/api/test/activity-catalog.int.spec.ts`
- 2026-10-15 | Safari/WebKit focus | Clicks don't focus buttons/links; Tab skips links by default | Store dialog triggers explicitly; WebKit tests focus skip link directly | `apps/web` dialogs + E2E
- 2026-10-15 | Advisory says "patched >=X" but X isn't published | braces 3.0.4 doesn't exist | Verify the patched version exists before planning an override; otherwise document an exception with a review date | `pnpm-workspace.yaml`

## P2 learnings (2026-10-15)

- 2026-10-15 | Foreign-Origin sign-out returned 200 in tests | Better Auth silently disables its Origin/CSRF checks when `NODE_ENV=test` | Pin `advanced.disableOriginCheck/disableCSRFCheck: false`; test security controls under the same NODE_ENV as production | `apps/api/src/modules/auth/auth-options.ts`
- 2026-10-15 | Oversized JSON returned 500 | body-parser errors are `http-errors`, not Nest exceptions | Map `expose: true` 4xx statuses in the error filter; never echo their message | `apps/api/src/common/errors/error-response.ts`
- 2026-10-15 | Auth libraries ship telemetry | `@better-auth/telemetry` installed transitively | Disable telemetry explicitly and assert no outbound calls in tests | auth integration tests
- 2026-10-15 | Rate limits keyed on X-Forwarded-For are spoofable | Default proxy trust lets clients pick their IP | `TRUST_PROXY=false` by default; auth reads an internal header overwritten from `req.ip` | `apps/api` config + middleware

- 2026-10-16 | Flaky E2E "fields empty at submit" was patched by retyping in the test | Controlled inputs drop text typed before hydration; native pre-hydration submit is GET and leaked the password into the URL | Never paper over a flaky form test - reproduce by delaying JS chunks; auth forms are uncontrolled (FormData) with submit gated until hydration and `method="post"` | `apps/web/components/auth-forms.tsx`, `tests/e2e/hydration-safety.spec.ts`
- 2026-10-16 | Intermittent pg "connection timeout" 500s under parallel sign-ups | scrypt hashing fills the 4-thread libuv pool that `localhost` DNS lookups for new connections also need | Cap concurrent hashing; raise connect timeout; reproduce under CPU contention | `apps/api/src/common/concurrency/limiter.ts`
- 2026-10-16 | Invitation auto-claim by verified email | Verification proves inbox control only if the verifier also owns the account; pre-registered accounts break that | Join via a token sent to the inbox AND a session for that address | D026

## P4 learnings (2026-10-16)

- 2026-10-16 | Flaky "join never answers" in parallel E2E | Instrumented: trivial DB lookups took 0.3-1.1 s at host load avg ~17-20 on 8 cores (Postgres in a 2-CPU Colima VM); client gave up after one 5 s ack | Measure before raising timeouts; make the client retry a timed-out join once; keep E2E workers modest on laptops | `apps/web/lib/live/connection.ts`
- 2026-10-16 | Rule changes ripple into clock-based tests | 15 s -> 20 s minimum broke deadline assertions in API recovery tests | Derive test clock math from the config constant, not literals | `apps/api/test/live-recovery.int.spec.ts`
- 2026-10-16 | Parallel agents sharing build output | `nest build` deletes `dist`, racing other agents' running servers | Build once centrally and tell parallel agents not to rebuild shared artefacts | orchestration

## Follow-up template

`YYYY-MM-DD | Trigger | Observed evidence | Reusable conclusion | Where applied`
