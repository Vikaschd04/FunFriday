---
name: privacy-by-design
description: Apply enterprise-grade privacy, content moderation, guest-token security and safe engagement analytics to all FunFriday features.
---

# FunFriday privacy and security baseline

Source: `docs/SECURITY_PRIVACY.md`. Tenant isolation, least privilege, secure cookies/session, hashed expiring invites, replay defense, input validation/sanitization, rate limits, appropriate CSP/CORS/origin. Password/crypto/session via vetted frameworks; no secret in Git/logs. Free text moderated, safe length, original/licensed assets. Personal facts opt-in and withdrawable before reveal; check-ins aggregate not mapped to individuals. Avoid employee scoring and small-group analytics reidentification. Include abusive/forged action tests.
