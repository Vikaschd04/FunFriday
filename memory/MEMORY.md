# FunFriday Portable Project Memory (Index)

This is a small, **version-controlled** memory index for humans and Claude Code. It is not the same as Claude Code's automatically managed machine-local `~/.claude/projects/.../memory/MEMORY.md`. Read this file and `STATUS.md` at session start. Keep this index under ~80 lines and place details in topic files.

- **Product north star:** Make voluntary cross-team connection easier for corporate remote/hybrid teams through low-pressure, delightful multiplayer activities; see `docs/PRODUCT_VISION.md`.
- **Working product name:** FunFriday. Similar brand names exist; legal/trademark/domain availability unverified.
- **Current phase:** P1 Design system + first screens done -> GO for P2. Usable local UI (landing, dashboard, library, planner with on-device drafts); no auth/persistence/games yet. Try it: `docs/LOCAL_TESTING.md`. See `memory/STATUS.md`.
- **Architecture baseline:** ADR 0001 accepted for P0 scope. Next 16 + NestJS 12 (ESM) + Prisma 7 (in `apps/api/prisma`) + Redis; pnpm 11/Turborepo; Zod contracts. Pinned versions in `docs/TECH_STACK.md`. Socket.IO arrives in P4.
- **MVP:** Six real activities (This or That, Emoji Check-In, Trivia Rush, Who Am I, Caption Clash, Sketch & Guess), events/invites, lobby, host controls, playlists, feedback. See `docs/PRD.md`, `docs/GAMES.md`.
- **Design:** premium, colorful corporate fun; WCAG 2.2 AA. Tokens + components in `packages/ui` (contrast-tested); screen spec `docs/design/P1_SCREENS.md`; honesty rules D016 (no dead/fake actions).
- **Trust:** server-authoritative action/score, secure tenant boundaries, invite-only access, no individual mood/performance monitoring. See `docs/SECURITY_PRIVACY.md`.
- **Source of decisions:** `memory/DECISIONS.md` (D010-D014 added in P0) and `docs/ADRs/`.
- **Phase evidence:** `docs/phases/P<n>_*.md` holds each phase's plan + gate report.
- **Deployment:** local-first by owner direction - no hosting work until initial phases are tested locally, then a deployment ADR (D009). Repo: github.com/Vikaschd04/FunFriday.
- **Current tasks and blockers:** `memory/STATUS.md`.
- **Learnings / corrections:** `memory/LESSONS.md`.
- **Continuity workflow:** after a meaningful session, update STATUS (truth), DECISIONS (only new changes), LESSONS (only reusable discoveries), and this index only if the top-level state changed.
- **Privacy:** never put access tokens, private employee facts, API keys or sensitive company data into this or other tracked memory files.
