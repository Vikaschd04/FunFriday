# ADR 0002: Authentication Provider and Tenancy Enforcement

- Date: 2026-10-15
- Owner: Lead engineer (P2)
- Status: **Accepted** for MVP/local phases. Revisit before first external pilot or when SSO is required.

## Context and decision drivers

P2 needs sign-in, sessions, organisations and role-based access. Constraints: owner wants local-only development (D009) with no external accounts or paid services; architecture asks for "provider adapter; managed or framework-standard auth; SSO/SCIM later"; "do not roll proprietary auth/crypto". The API (NestJS, port 4000) and web (Next.js, port 3000) are separate services; P4 adds Socket.IO, which must authenticate with the same session.

## Alternatives considered

| Option | Pros | Cons |
| --- | --- | --- |
| Managed (Auth0, Clerk, Microsoft Entra External ID) | Enterprise SSO, MFA, compliance out of the box | External account + credentials now; cost; contradicts local-first; vendor lock-in for user data |
| Auth.js in Next.js | Familiar, framework-standard | Session lives in the web app; API and sockets must trust tokens minted elsewhere; org/role model DIY anyway |
| Keycloak (self-hosted OIDC IdP) | Standards-based, SSO brokering | Heavy container + ops, disk-constrained dev machine, slow iteration |
| **Better Auth in the API** | Self-hosted, TypeScript, DB sessions via Prisma, built-in CSRF origin checks and rate limiting, scrypt password hashing, SSO/OIDC plugins available later | Library-owned table shape; young ecosystem (v1 since 2024-11) |
| Hand-rolled sessions | Full control | Rejected: proprietary auth/crypto risk |

## Decision

1. **Better Auth 1.7.8** runs inside `apps/api`, mounted at `/api/v1/auth/*`, configured for email + password, database sessions (Prisma adapter, our migrations own the tables), cookie prefix `funfriday`, HttpOnly, SameSite=Lax, Secure whenever the origin is https, trusted origins = `WEB_ORIGIN`, built-in auth rate limiting.
2. **Adapter boundary**: the rest of the API depends only on an `AuthSessionPort` (`getSession(request) -> { userId, email, emailVerified, name } | null`). Guards, controllers and P4 socket handshakes use the port, never the library directly. Replacing the provider (managed OIDC, Entra) touches the adapter and the auth tables only.
3. **Email** uses a `MailerPort`. Locally it is a **dev mailbox** (outbox table + dev-only API/page, disabled unless `DEV_MAILBOX_ENABLED=true`, `NODE_ENV !== 'production'` and the API is bound to loopback). P3 adds a real provider adapter. Sign-in does not require verification. **Joining an organisation requires accepting an emailed one-time invitation link while signed in with the invited address (D026, amended 2026-10-15 after security review: auto-claiming by verified email allowed account pre-hijacking).**
4. **Tenancy enforcement is ours, not the library's**: organisations, memberships, roles, teams and the audit log are our Prisma models and services. Every org-scoped request resolves the caller's ACTIVE membership; non-members get 404, wrong role 403. Composite foreign keys keep team membership within one organisation at the database level.
5. **CSRF**: SameSite=Lax cookies + Origin allowlist check on every state-changing request (Better Auth for its routes, our guard for the rest) + JSON-only bodies (forces CORS preflight cross-origin).
6. **Guests** (P4) will not get user accounts: short-lived, session-scoped, hashed tokens with no org directory access (`docs/design/GUEST_IDENTITY.md`).

## Consequences

- Passwords are stored as scrypt hashes by the library; we never log request bodies on auth routes.
- Session cookies are host-scoped (`localhost` works across ports 3000/4000 locally; production must place web and API on the same site, e.g. `app.` and `api.` subdomains).
- Multi-instance deployments must move auth rate limiting to shared storage (Redis/DB) - tracked for the deployment ADR.
- Enterprise SSO (SAML/OIDC) and SCIM are not available yet; P9 decides between Better Auth plugins and a managed IdP.

## Migration, rollback and test strategy

- Additive migration; no existing data. Rollback = revert commit + drop new tables locally.
- Tests: schema parity between Prisma models and Better Auth's expected tables; HTTP integration tests for sign-up/in/out, cross-tenant and role matrices, CSRF origin rejection, rate limiting, verified-email membership claims; two-user browser E2E.

## Links

`docs/phases/P2_IDENTITY_TENANCY.md`, `docs/SECURITY_PRIVACY.md`, `memory/DECISIONS.md` D021-D025.
