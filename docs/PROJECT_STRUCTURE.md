# Target Repository Layout After Phase P0

The following **planned** tree is not included as working application code. Claude Code must create and verify it in Phase P0.

```text
funfriday/
  apps/
    web/
      app/
      components/
        dashboard/
        events/
        games/
        lobby/
        results/
      features/
      lib/
      public/
      tests/
    api/
      src/
        modules/
          auth/
          organizations/
          teams/
          events/
          invitations/
          sessions/
          games/
          analytics/
        realtime/
          gateways/
          room-manager/
          room-state/
        common/
          auth/
          validation/
          errors/
      test/
  packages/
    ui/
      src/components/
      src/tokens/
    contracts/
      src/http/
      src/events/
      src/games/
    game-core/
      src/common/
      src/games/
        this-or-that/
        emoji-check-in/
        trivia-rush/
        who-am-i/
        caption-clash/
        sketch-and-guess/
    config/
  prisma/
    schema.prisma
    migrations/
  tests/
    e2e/
    realtime/
    performance/
  infra/
  docs/
  memory/
  .claude/
    agents/
    skills/
    rules/
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  turbo.json
  CLAUDE.md
```

**P0 adjustment (ADR 0001 / D011):** Prisma lives in `apps/api/prisma` (schema, migrations, seed) with the generated client in `apps/api/src/generated` (gitignored), not at the repo root, because only the API may access the database. Root `tests/` currently holds `tests/performance`; app-level tests live beside each app (`apps/api/test`, `apps/web/tests/e2e`).

The lead may adjust the layout via ADR if a simpler arrangement demonstrably improves maintenance and delivery. One source of truth per contract, no circular dependencies, clean naming and production-grade state handling are essential.
