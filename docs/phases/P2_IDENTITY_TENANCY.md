# Phase P2 - Identity, Organisations and Tenancy: Plan and Gate Report

- Started: 2026-10-15. Lead/integrator: main session. Roadmap block: `docs/ROADMAP.md` -> P2.
- Gate (roadmap): cross-tenant and role API tests green.
- Owner direction: local-first (D009); no external accounts or paid services -> self-hosted auth (ADR 0002).

## Outcomes (three)

1. **Sign-in that is real**: sign-up, sign-in, sign-out, secure cookie sessions, email verification through a local dev mailbox (no email provider needed).
2. **Organisations with enforced roles**: create an organisation, add members by email, Admin / Host / Participant roles, teams - with tenant isolation enforced by the API *and* the database.
3. **Trust controls**: audit log of privileged actions, CSRF/origin checks, rate limits, nonce-based CSP, guest-identity and consent/retention designs ready for P4/P6.

## Key decisions (ADR 0002 + D021-D025)

- **Auth library**: Better Auth 1.7.8 inside the API (email + password, database sessions via Prisma, HttpOnly cookies `funfriday.*`, SameSite=Lax, Secure outside localhost) behind an `AuthSessionPort` adapter so a managed/OIDC provider can replace it later. No hand-rolled crypto.
- **Adding members (D022 -> D026)**: an admin adds a member by email; the response is identical whether or not an account exists (no enumeration). The invitee receives a **one-time invitation link** (dev mailbox locally) and joins by accepting it while signed in with that address; accepting verifies the email. *Amended after the security review: the original auto-claim on a verified email allowed account pre-hijacking.*
- **Tenant isolation (D023)**: every org-scoped route resolves the caller's ACTIVE membership first; non-members get `404 NOT_FOUND` (no existence leak), insufficient role gets `403 FORBIDDEN`. Team membership uses composite foreign keys `(orgId, ...)` so a team can never contain a member of another organisation, even through a bug.
- **Roles (D024)**: Admin = members, roles, teams, audit log, settings. Host = teams + (P3) events. Participant = read org summary, member names (no emails), teams. Last active Admin cannot be demoted or removed.
- **Privacy**: member emails visible to Admins only; audit log stores ids and action names, never passwords or tokens; sessions revocable.

## Contracts (`packages/contracts/src/identity/*`)

`me`, organisation summary/create, membership list/add/update, team list/create/member changes, audit entries, role and status enums, request bodies with length limits.

## Sequence and ownership

| # | Task | Owner | Paths | Depends |
| --- | --- | --- | --- | --- |
| T1 | Plan, ADR 0002, identity contracts + tests | lead | docs, `packages/contracts` | - |
| T2 | Auth integration, Prisma models + migration, org/membership/team/audit/dev-mailbox modules, guards, throttling, origin checks, integration tests | `backend-engineer` | `apps/api/**` | T1 |
| T3 | Web proxy: nonce CSP + signed-out redirect for `/app/*` | lead | `apps/web/proxy.ts`, `next.config.ts` | T1 |
| T4 | Web: sign-up/in/out, verify notice, dev mailbox, onboarding (create org), org switcher, members/teams/audit screens, denied states, E2E incl. two-user tenant tests | `frontend-engineer` | `apps/web/{app,components,lib,tests}` | T2, T3 |
| T5 | Guest identity + consent/retention design docs | lead | `docs/design/` | T1 |
| T6 | Gate: security (auth/tenancy focus), accessibility | reviewers (read-only) | - | T4 |
| T7 | Fixes, full verification, docs/memory, commit + CI | lead | - | T6 |

## Acceptance checks

- [x] Sign-up / sign-in / sign-out / session expiry work against the real API; cookies HttpOnly + SameSite=Lax; session ids never in URLs or logs.
- [x] Better Auth schema parity test: Prisma models match the library's expected tables/fields.
- [x] Every org-scoped route: non-member -> 404, wrong role -> 403, unauthenticated -> 401 (table-driven integration test).
- [x] Joining requires the emailed invitation token AND a session for the invited address; pre-hijack scenario (attacker pre-registers the victim's email) cannot join; tokens single-use, expiring, hashed.
- [x] Adding a member returns the same response whether or not the email has an account.
- [x] Last-admin protection; role changes and removals audited; audit log admin-only.
- [x] DB rejects a team member from another organisation (composite FK test).
- [x] Mutations with a foreign `Origin` are rejected; auth endpoints rate-limited.
- [x] Nonce-based CSP with no `'unsafe-inline'` scripts; no violations in E2E.
- [x] E2E: two users in separate browser contexts - admin creates org, adds member, member verifies via dev mailbox and sees the org; participant gets denied states; signed-out `/app` redirects to sign-in.
- [~] Lint/typecheck/unit/build/integration/E2E (3 browsers) green locally; CI recorded below after push.

## Risks

- Third-party auth library integration in NestJS ESM + Prisma 7: mitigated by schema-parity and full HTTP integration tests.
- Dev mailbox must never be reachable in production: fail-closed config flag + test.
- Larger scope than P1: strict ownership split (API vs web) and contract-first.

## Gate report (QA_REPORT format)

- Date: 2026-10-16, final run 10:47-10:52 IST, `TURBO_FORCE=true`. Environment as P1.
- Owners: lead (plan, ADR, contracts, proxy/CSP, docs, integration, hydration fix); `backend-engineer` (API + fix pass); `frontend-engineer` (web + follow-up); independent `security-reviewer` and `accessibility-reviewer` (read-only).

| Check | Result | Evidence |
| --- | --- | --- |
| Install (frozen) / audit / format / lint / typecheck / build | PASS | all exit 0 |
| Unit | PASS | 320: ui 133, web 101, api 44, contracts 33, game-core 9 |
| Integration (real Postgres + Redis) | PASS | 158 in 12 files incl. 70-case authorization matrix, invitations (pre-hijack, single-use, expiry, wrong account, races), auth hardening, schema parity, 30-parallel sign-up concurrency |
| E2E Chromium + Firefox + WebKit | PASS | 207/207 (69 per browser), 0 flaky in final run: sign-up/in/out, invitation links, two-user tenancy, denied/not-found, axe WCAG 2.2 AA on every screen at 320 + 1440, nonce CSP, hydration safety |
| Security review | PASS after fixes | 2 stop-ship (pre-hijack, placeholder secret) + 6 medium/low fixed; no IDOR found |
| Accessibility review | PASS (no blockers) | 3 medium + 3 low fixed; manual screen reader / zoom / forced colours NOT RUN |
| GitHub CI | see below | recorded after push |

### Defects found and fixed in P2

1. **Account pre-hijack** (security review, stop-ship): auto-claim on a verified email let an attacker who pre-registered a victim's address take their invitations -> one-time emailed invitation links (D026), proven by an attack test.
2. **Placeholder `AUTH_SECRET` accepted** (stop-ship) -> rejected (incl. the exact `.env.example` value).
3. **Better Auth disables Origin/CSRF checks when `NODE_ENV=test`** (backend) -> pinned on in every environment.
4. **Unbounded auth request bodies, over-posting on update-user, dev mailbox reachable off-loopback, spoofable proxy trust, verification mail-bombing, cookie-name-dependent origin guard** -> all fixed with tests.
5. **DB pool timeouts (500) under parallel sign-ups**: scrypt saturated the libuv pool needed by `localhost` DNS for new pg connections -> hashing concurrency limiter + 5 s connect timeout; reproduced before/after.
6. **Oversized JSON returned 500** -> 413 envelope.
7. **Typing before hydration was discarded** on sign-in/sign-up (a flaky E2E had been "fixed" by retyping) -> uncontrolled inputs read at submit; workaround removed.
8. **Pressing Enter before hydration put the password in the URL** (native GET submit) -> submit gated until hydration + `method="post"`; regression tests delay JS chunks to prove both.
9. Accessibility: password toggle semantics, focus on auth failures and sign-out notice, org-switch announcement, mobile workspace menu name, paste/autocomplete test.

### Open follow-ups

- Password reset flow (not configured; no link shown) - P3 with the email adapter.
- Sign-up reveals existing accounts (library behaviour; rate limited) - revisit with P3 email flows.
- In-memory auth rate limits (single instance) - shared storage before scaling (deployment ADR).
- Resend/revoke invitation endpoint; expired invites need remove + re-add.
- Manual a11y passes (VoiceOver/NVDA, 200-400% zoom, forced colours, real Safari).
- E2E runs 3 workers with a 60 s timeout because sign-up hashing is deliberately throttled; revisit with load tests (P8).

### Gate decision

**GO for P3 pending CI.** All mandatory checks pass locally; both stop-ship security findings fixed and proven by tests; no open critical/high defects. Nothing deployed (D009).
