# Phase P1 - Premium Design System: Plan and Gate Report

- Started: 2026-10-15. Lead/integrator: main session. Roadmap block: `docs/ROADMAP.md` -> P1.
- Gate (roadmap): visual + keyboard/reduced-motion review, screenshots at 320px / tablet / desktop.
- Owner direction (D009): everything stays local; no deployment work.

## Outcomes (three)

1. **Design system** in `packages/ui`: full token set (colour, type scale, spacing, radii, shadows, motion, z-index) and accessible React components with tests.
2. **First real screens**: marketing landing, responsive app shell (sidebar / tablet rail / mobile bottom bar), dashboard, activity library on real API data, event-builder prototype, system status, 404/error/loading states.
3. **P0 follow-ups due in P1**: web security headers + CSP, CI action SHA pinning + Dependabot + `pnpm audit`, Firefox/WebKit E2E projects.

## Honesty rules for UI without accounts or persistence (decision D016)

- Library cards come from a real endpoint `GET /api/v1/activities` (read-only global catalog; pulled forward from P3). No mock data.
- Event builder is a real, validated stepper (Basics -> Participants -> Activities -> Review). Its only save action is **"Save draft on this device"** (browser storage, labelled as such). No "Create event", "Send invites" or email collection until P3 provides persistence and delivery.
- Dashboard shows a visible "Preview workspace - accounts arrive in a later phase" notice, real local drafts, and the designed empty state.
- Navigation lists only screens that exist. "Join with a code" and sign-in appear when P2/P4 build them.
- Denied state is built and component-tested; it is wired to real authorization in P2.
- Dark theme deferred (optional in `docs/DESIGN_SYSTEM.md`); no Motion/Radix dependencies unless a component needs them.

## Contracts (single source: `packages/contracts`)

- `activitySummarySchema`, `activityListResponseSchema`, `activityCategorySchema`.
- `eventDraftSchema` (title, local start, IANA time zone, duration, expected group size, optional https meeting URL, ordered activity playlist with minutes) + pure `reviewEventPlan()` (time budget, capacity warnings) + `zonedWallTimeToUtc()` (DST-aware, rejects non-existent local times). P3 reuses these for persistence.

## Sequence and ownership

| # | Task | Owner | Paths | Depends |
| --- | --- | --- | --- | --- |
| T1 | Contracts above + tests | lead | `packages/contracts` | - |
| T2 | Screen + component spec (layouts, states, copy, motion) | `product-designer` | `docs/design/P1_SCREENS.md` | T1 |
| T3 | Activities endpoint, additive migration (category, display order), seed, tests | lead (backend role) | `apps/api` | T1 |
| T4 | Web headers/CSP, CI hardening, Playwright Firefox/WebKit | lead (devops role) | `apps/web/next.config.ts`, `.github/**`, `apps/web/playwright.config.ts` | - |
| T5a | Design system: tokens + components + component tests | `frontend-engineer` | `packages/ui/**` | T2 |
| T5b | Screens + E2E | `frontend-engineer` (same agent, continued) | `apps/web/{app,components,lib,tests}` | T3, T5a |
| T6 | Gate reviews: accessibility, visual (designer vs spec + screenshots), security (CSP, endpoint) | reviewers, read-only | - | T5b |
| T7 | Integration, full verification, docs/memory, commit + CI | lead | - | T6 |

## Acceptance checks

- [x] Token contrast tests cover every text/UI pair used; components have unit tests (render, keyboard, ARIA, states).
- [x] `GET /api/v1/activities` returns the six activities in display order, contract-valid; integration-tested; no internal ids.
- [x] Library: search, category/size/duration filters, no-results, loading, error/retry, capacity notice - on real data.
- [x] Builder: per-step validation with field-associated errors, time-zone clarity incl. DST gap, runtime meter, keyboard reorder, local draft save/restore/delete, no dead actions.
- [x] Dashboard: empty state, drafts list from local storage, preview notice.
- [x] App shell: sidebar >= 1024px, rail 768-1023px, bottom bar < 768px; skip link; current page indicated.
- [x] 404, error boundary, loading states; reduced motion honoured (error boundary built, not E2E-exercised).
- [x] E2E (Chromium, Firefox, WebKit): journeys above + axe WCAG 2.2 AA zero serious/critical on every screen + 320px no horizontal scroll.
- [x] Screenshots 320 / 768 / 1440 for each screen reviewed by the lead and `product-designer`.
- [x] CSP + security headers present; CI actions pinned by SHA; Dependabot; `pnpm audit` gate.
- [x] `pnpm lint/typecheck/test/build/test:integration/test:e2e` green locally and in GitHub CI ([run 38773479161](https://github.com/Vikaschd04/FunFriday/actions/runs/38773479161)).

## Risks

- Larger UI surface -> consistency drift: mitigated by one spec + one component library + designer review.
- Local-storage drafts could be mistaken for saved events: mitigated by explicit labelling and copy review.
- Next.js inline scripts limit CSP strictness without nonces: P1 ships a baseline CSP; nonce-based CSP with P2 dynamic auth pages.

## Gate report (QA_REPORT format)

- Date: 2026-10-15, final run 22:24-22:27 IST, `TURBO_FORCE=true` (no cache). Environment as P0 plus Firefox 157 / WebKit 27.2.
- Owners: lead (contracts, API, devops/security, integration); `product-designer` (spec + visual review); `frontend-engineer` (packages/ui, screens, E2E); independent reviewers `accessibility-reviewer`, `security-reviewer`, `product-designer` (read-only).

| Test / command | Result | Evidence | Risk |
| --- | --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | exit 0 | - |
| `pnpm audit --audit-level high` | PASS | 0 unignored; 1 documented exception (D018) | Review 2026-11-15 |
| Format / lint / typecheck | PASS | exit 0 / 8 tasks / 8 tasks | - |
| Unit `pnpm test` | PASS | 249: ui 133, web 60, contracts 26, api 21, game-core 9 | - |
| Build | PASS | 6/6; routes `/`, `/status`, `/app`, `/app/library`, `/app/events/new`, 404 | - |
| Integration | PASS | 16 vs real Postgres/Redis (activities order, disabled hidden, no ids, cache + CORS; exact CHECK constraints) | - |
| E2E `CI=1 pnpm test:e2e` | PASS | **135/135** = 45 each on Chromium, Firefox, WebKit; axe 0 serious/critical on every screen + builder step; 320px + 640x360 reflow; keyboard reorder/focus; dialogs; route-change focus; CSP no violations | WebKit skip-link test focuses link directly (Safari Tab setting) |
| Visual review | PASS | 33 screenshots; lead + designer; Must-fix items fixed and re-shot | Nice-to-haves open |
| Accessibility review | PASS (no blockers) | H1, M1-M4, L1-L3 fixed | Manual SR / 200% / forced colours NOT RUN |
| Security review | PASS (no stop-ship) | drafts hardening, href guard, permissions, SHA verification done | Nonce CSP P2 |
| GitHub CI | PASS | [run 38773479161](https://github.com/Vikaschd04/FunFriday/actions/runs/38773479161) on `a9c26bf`: 18/18 steps in 4.4 min on ubuntu-latest - pinned v7/v6 actions, audit gate, 3-browser E2E, load smoke | - |

### Defects found and fixed during P1

1. Builder step 3 at 320px squeezed notices mid-word (lead visual review; a11y H1) - rows stack, one combined notice + row badge.
2. Focus stolen after invalid save / leave-dialog save (a11y M1) - single focus request; action-closed dialogs don't restore focus.
3. Focus lost on "Clear filters" (M2) and no focus move on route change (M3) - fixed + E2E.
4. Meter invisible in forced colours (M4) - system colours/outlines (CSS-inspected only).
5. Unformatted files (48) - repo-wide Prettier; CI gate.
6. Old P0 constraint tests would have passed for the wrong reason after the schema change - now assert the exact CHECK constraint.
7. Dependency audit: 3 high + 1 moderate - 2 fixed by overrides, 1 documented exception (no patched release).

### Open follow-ups

- Manual a11y passes (VoiceOver/NVDA, real 200-400% zoom, Windows forced colours, real Safari) - before pilot (P8) or earlier.
- `error.tsx` not E2E-exercised; `beforeunload` not asserted; browser back not guarded for unsaved drafts.
- Nonce-based CSP (P2); rate limit before org-specific content (P2); unsaved-guard href E2E (low).
- Design nice-to-haves: dashboard empty-card tint, clickable landing category tiles, stronger agenda transition rows; Review meter label list repeats the side panel.

### Gate decision

**GO for P2.** All mandatory checks pass locally and in GitHub CI; no open critical/high defects; owner direction (local-first) respected - nothing deployed. P2 not started.
