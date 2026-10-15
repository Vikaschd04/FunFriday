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

## Follow-up template

`YYYY-MM-DD | Trigger | Observed evidence | Reusable conclusion | Where applied`
