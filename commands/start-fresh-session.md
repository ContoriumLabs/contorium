---
name: start-fresh-session
description: Start a fresh Contorium AI context session after a major task or workspace shift.
---

# Start fresh AI context session

Use when the user switched goals (e.g. landing page → auth bug) and old session telemetry should not pollute the next export.

1. Confirm the user wants to clear **session-scoped** activity (not long-term workspace files or Git).
2. Run **Contorium: Start fresh AI context session** (`contora.startFreshAiSession`), or accept **Start fresh** when Contorium detects a workspace shift after updating Current focus.
3. After reset, suggest setting **Current focus** and resuming work so heuristic intent repopulates.
