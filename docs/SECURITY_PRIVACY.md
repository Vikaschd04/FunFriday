# Security, Privacy, Trust and Moderation

## Risk model

Primary risks: invite-link theft, organization boundary breach, host privilege escalation, XSS in captions/chat, guessing personal identities without consent, score manipulation, WebSocket event flooding, user-generated image abuse, calendar/email token leakage, and overly intrusive HR metrics.

## Non-negotiable controls

- All data access scoped to organization; enforce both authn and authz at API and Socket gateway.
- Event invites use short-lived signed or cryptographically random tokens stored only as hashes server-side; revoke on cancel/remove.
- Room code is for discovery only unless coupled with safe guest consent and short-lived access token; limit join attempts.
- Host action permission asserted server-side; client cannot set `isHost` or dictate server time.
- Use Zod or equivalent on *every* inbound message, including payload size and string length; sanitize untrusted display content.
- Rate-limit chat, guesses, votes, join attempts and draw strokes, with per-actor and per-tenant ceilings.
- Secrets remain in environment/secret manager; never log raw tokens, invites, personal facts or payment details.
- Validate uploads MIME, file size, content, type allowlist and ownership; use signed object URLs and expiration.
- Set appropriate CORS, secure cookies, CSP, CSRF and transport origins per implementation; maintain audit logs for privileged actions.
- Email sending/outbox idempotent to avoid unintended duplicate notifications.

## Employee privacy and inclusion

- No mandatory video/camera use, personality tests, protected-attribute questions or forced social disclosure.
- Who Am I? facts are opt-in, moderator-approved, withdrawable before reveal and not shown outside intended participants without consent.
- Emoji Check-In stores only necessary aggregate counts; avoid per-person mood dashboards or personnel usage scoring.
- Aggregate telemetry for admins. Suppress small-group breakdowns where re-identification risk exists.
- Chat/caption/stroke retention limited; explicit opt-in for shareable highlights and exporting media.
- Offer accessible alternatives and pass/observe; do not penalize non-disclosure.
- Allow org admins to define retention/deletion policy with documented defaults.

## Moderation

- Community conduct guidelines in lobby; report/flag action, host remove/kick (audited), block abuse.
- For free-text captions and guest names: length limit, profanity/abuse filtering, human host moderation/approval, safe HTML rendering.
- For images: only original or licensed packs in MVP, uploader moderation post-MVP.
- Host can end unsafe content quickly and suspend participant submissions.

## Security review checklist

- [ ] Tenant isolation test across all route/resource types.
- [ ] Host/participant/guest role abuse checks on HTTP + socket.
- [ ] Expired/revoked invite behavior.
- [ ] XSS/CSP/HTML sanitization checks for captions/profiles/chat.
- [ ] Rate limits tested with burst and reconnect storms.
- [ ] Private trivia answers and Who Am I consent not leaked in network payloads.
- [ ] Logging removes secrets, no accidental PII stored.
- [ ] Appropriate data retention/delete tests.
- [ ] Supply chain audit and vulnerability triage.
- [ ] Backup encryption / restore rehearsal / incident plan.

Reference OWASP ASVS, WCAG 2.2, and applicable privacy obligations. This kit is not legal/compliance certification.
