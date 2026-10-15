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

## Follow-up template

`YYYY-MM-DD | Trigger | Observed evidence | Reusable conclusion | Where applied`
