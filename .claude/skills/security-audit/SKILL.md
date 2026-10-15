---
name: security-audit
description: Perform a focused independent read-only FunFriday security and privacy review on a component or current phase.
disable-model-invocation: true
---

# Focused security audit $ARGUMENTS

Delegate to `security-reviewer` (read-only). Read only changed files and `docs/SECURITY_PRIVACY.md` plus directly related API/contracts. Attempt abuse analysis for org boundary, RBAC, socket host commands, token expiry/replay, XSS/caption, answer leaks and rate limits. Return severity-ranked vulnerabilities with file:line and reproduction or bounded reasoning. Distinguish static review from executed tests. Lead owns fixes and repeat validation. Do not output secrets.
