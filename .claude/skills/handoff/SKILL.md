---
name: handoff
description: Save a compact, accurate FunFriday implementation handoff and project memory so Claude Code can resume across sessions.
disable-model-invocation: true
---

# Save a project handoff $ARGUMENTS

1. Check Git status/diff and what was actually accomplished; ask no question if evidence exists.
2. Update `memory/STATUS.md` with phase state, completed evidence, blocked/unverified items, next three actions and owner.
3. Add only durable non-sensitive observations to `memory/LESSONS.md`; architectural changes to `memory/DECISIONS.md` and ADR when necessary.
4. Update `memory/MEMORY.md` short index **only** if top-level status/decision changed.
5. Use `memory/HANDOFF_TEMPLATE.md` format for last output. Never record keys, private employee facts or invented test passes.
