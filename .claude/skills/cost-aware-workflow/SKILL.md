---
name: cost-aware-workflow
description: Reduce Claude Code token and coordination cost for FunFriday by loading only relevant context and using narrow subagent tasks.
disable-model-invocation: true
---

# Lean execution protocol

Before a major task, inspect `memory/STATUS.md` and targeted repo paths; avoid opening every doc. Use the current phase as scope boundary. Read only the selected game/feature spec and linked architecture decisions. Prefer a single coding agent for sequential tasks; delegate separate read-only QA/research to isolated subagents. Avoid speculative full repository rewrites, long duplicated logs and unnecessary recurring architecture debates. Keep CLAUDE.md under ~200 lines, the memory index short, and skill bodies concise. Summarize findings with paths, commands and next action. Do not reduce necessary testing to save tokens.
