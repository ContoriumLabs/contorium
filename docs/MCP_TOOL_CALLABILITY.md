# MCP Tool Callability Report

> Last verified: **2026-07-23**  
> Workspace: Contorium monorepo  
> Harness: `scripts/verify-mcp-tools.mjs`  
> Commands: `npm run test:mcp-tools` · `npm run test:mcp-tools:prefer`

This report records whether Contorium MCP tools can be **listed**, **schema-validated**, and **successfully invoked** by an MCP client — the same path an LLM host uses (`tools/list` → `tools/call`).

---

## Verdict

| Suite | Result |
| ----- | ------ |
| Preferred tools (~20) | **20 / 20 passed** |
| Full catalog (107) | **107 / 107 passed** (after fixing test args / timeouts) |
| Preferred tools missing from list | **0** |
| Description quality (length &lt; 20) | **0** in preferred set |

**Conclusion:** Contorium MCP tools are discoverable and callable. An LLM that follows server `instructions` and tool `description` fields can select and invoke the preferred set correctly. Heavy governance-cycle tools work but are **slow** (1–3 minutes) and should be used sparingly.

---

## How to re-run

```bash
# Preferred set only (~2–3 min warm)
npm run test:mcp-tools:prefer

# Full catalog (can take 15–30+ min on a large workspace)
npm run test:mcp-tools

# Subset
node scripts/verify-mcp-tools.mjs --only "ask_project,transfer_project"

# From the MCP package
npm run test:tools --prefix packages/mcp
npm run test:tools:prefer --prefix packages/mcp
```

Prerequisites: `npm run build:mcp` (or `npm run compile`) so `packages/mcp/dist` is current.

---

## Preferred tools (LLM default surface)

These are the tools server `instructions` tell agents to prefer:

| Tool | Role | Smoke result |
| ---- | ---- | ------------ |
| `ask_project` | NL Q&A | OK |
| `transfer_project` | Unified export | OK |
| `capture_focus` / `capture_note` / `capture_decision` | Write memory | OK |
| `inspect_state` / `inspect_intent` / `inspect_decision` / `inspect_why` / `inspect_health` | Structured read | OK |
| `get_knowledge_health` / `get_review_queue` / `set_decision_lifecycle_meta` | Lifecycle | OK |
| `get_next_actions` / `get_decisions` | Suggestions / ADR list | OK |
| `get_recent_events` / `get_project_history` | History | OK |
| `get_handoff_injection_status` / `confirm_handoff_injection` / `skip_handoff_injection` | New-chat continuity | OK |

Typical preferred-suite timings on this workspace (order-of-magnitude):

- Fast inspect / capture / handoff status: **&lt; 1 s**
- `ask_project`, history, transfer, lifecycle: **~5–25 s**
- Full preferred suite wall time: **~2–3 min** after MCP bootstrap

---

## Full catalog (107)

Registration layers (approximate counts):

| Layer | Examples | Count (approx.) |
| ----- | -------- | --------------- |
| Cognitive overlay | `get_cognitive_mode`, `get_skill_suggestions` | 5 |
| Governance aux | `record_project_intent`, `analyze_project` | 5 |
| Governance V4 | `derive_decision_provenance`, ready/inject aliases | 17 |
| Intelligence aliases | `get_project_*`, `get_cognitive_snapshot` | 14 |
| PIL runtime | `inspect_*`, `transfer_*`, `capture_*` | 18 |
| CIL runtime | `ask_project`, `transfer_project`, lifecycle… | 22 |
| AI layer | `get_ai_status`, `test_ai_connection` | 2 |
| Server memory / handoff / legacy reads | `store_memory`, `get_project_handoff`, … | 24 |

First full-suite pass (2026-07-23) reported **100 / 107** until test harness bugs were fixed:

| Failure (first pass) | Root cause | Fix |
| -------------------- | ---------- | --- |
| `resolve_scope_context` | Harness sent `mode: "project"` | Valid enum is `auto \| strict \| minimal` |
| `derive_decision_provenance` (+ 5 aliases) | Client timeout 90 s | Tools need ~2–3 min; harness now uses 180 s + `active_file` + `mode=advisory` + `persist=false` |

Re-test of those 7 tools: **7 / 7 passed**. Combined with the 100 already OK → **107 / 107 callable**.

---

## Slow / high-cost tools

Call **at most one** provenance cycle per turn. Aliases share the same handler.

| Tool | Typical duration (this workspace) | Guidance for LLMs |
| ---- | --------------------------------- | ----------------- |
| `derive_decision_provenance` | ~2–3 min | Preferred once; pass `active_file`, `mode=advisory`, `persist=false` |
| `derive_decision_trace` | same | Alias — do not also call |
| `decision_snapshot` | same | Alias |
| `build_decision_provenance` | same | Legacy alias |
| `run_governance_cycle` | same | Legacy alias |
| `trace_governance_cycle` | same | Legacy alias |
| `inspect_cognition_ready` / ready aliases | ~10–20 s | Only on fresh workspace / before first derive |

Faster alternatives for ordinary questions:

- `ask_project`
- `get_decision_context`
- `inspect_decision` / `get_decisions`
- `get_knowledge_health` / `get_review_queue`

Descriptions and server `instructions` now mark these with **`[SLOW]`** and tell agents not to fan-out aliases.

---

## Call strategy (recommended for hosts / agents)

```text
1. Prefer PREFERRED set from MCP instructions
2. NL question → ask_project
3. New chat → get_handoff_injection_status → confirm/skip
4. Export → transfer_project(mode=…)
5. Decision validity → get_knowledge_health / get_review_queue
6. Full provenance only when user asks for governance derive / inject
   → inspect_cognition_ready (if needed)
   → get_decision_context
   → derive_decision_provenance (ONCE)
   → synthesize_context_payload
7. Never call run_governance_cycle + derive_decision_provenance together
```

---

## Related docs

- [MCP.md](./MCP.md) — install, host config, catalog overview  
- [packages/mcp/README.md](../packages/mcp/README.md) — package-level LLM selection table  
- Harness: [`scripts/verify-mcp-tools.mjs`](../scripts/verify-mcp-tools.mjs)

---

## Maintenance

When adding or renaming a tool:

1. Register with a description that includes **when to call**, **prefer-over**, and **side effects** (and `[SLOW]` if heavy).
2. Add an entry to `ARG_OVERRIDES` in `verify-mcp-tools.mjs` if required args are non-obvious.
3. If it belongs in the default agent surface, add it to `PREFERRED` in both the harness and `MCP_SERVER_INSTRUCTIONS`.
4. Run `npm run test:mcp-tools:prefer` (and full suite before release).
