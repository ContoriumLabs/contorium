# Contorium — Project Overview

**Contorium** is a local **AI Project Intelligence Layer (PIL)** with a **Cognitive Interaction Layer (CIL v3)** on top. It preserves project understanding across Cursor, Claude Code, Codex, Gemini CLI, VS Code, and other MCP-compatible tools.

```text
Capture → Structure → Preserve → Retrieve → Transfer
```

Contorium is **not** an autonomous coding agent. It records, structures, preserves, and transfers project intelligence so developers and AI tools can maintain continuity across sessions.

> **Contorium records and preserves project intelligence. It does not decide for the project.**

- [Documentation index](./README.md) · [Install / Uninstall](./INSTALL.md) · [Three-surface architecture](./SURFACES.md)

---

## Feature layers

### PIL — fact storage (`.contora/`)

Answers **what is stored**. Fact engines do **not** call LLMs.

| Object | Question |
|--------|----------|
| STATE | What exists now? |
| INTENT | What is the goal? |
| DECISION | What was decided? |
| WHY | What reasoning supports it? |
| TIMELINE / IMPACT / EVOLUTION / PROVENANCE | When, what is affected, how it evolved, where it came from |

**Runtime contract (v3.0)** — aligned across IDE, MCP, and CLI:

| Group | Purpose | Examples |
|-------|---------|----------|
| **Capture** | Write focus, notes, decisions | `capture_focus` |
| **Inspect** | Read state, graphs, health | `inspect_state` |
| **Transfer** | Export for AI continuity | `transfer_context` |

### CIL — cognitive interaction

Answers **how users and agents ask and explore**. Routes through **Cognitive Kernel** — suggestions and narratives only, **never executes tasks**.

| User question | Route |
|---------------|-------|
| What happened? | History |
| Why this decision? | Decision Center |
| What should I do next? | Action Engine (suggestions) |
| Tell me this project | Story / Essence / DNA |
| State on a past date? | Time Travel (Snapshot) |
| Everything about X? | Knowledge Graph / Entity |
| Is cognition healthy? | Cognitive Health |
| Is knowledge still valid? | Knowledge Lifecycle + Review Queue + impact chains |
| What needs review? | Review Queue (invalidation triggers) · IDE top banner |

CLI: `contorium ask` · `contorium lifecycle` · `contorium review` · MCP: `ask_project` · `get_knowledge_health` · `get_review_queue` · IDE: **Ask Contorium** / Explore panels

### AI Layer — explanation (optional, default off)

**Facts without LLM; explanations may use LLM.**

| LLM allowed | LLM forbidden |
|-------------|---------------|
| Why polish, Story/Essence/DNA narrative, Ask enhance, Intent Router (hybrid) | eventEngine, snapshotEngine, knowledgeGraph, decisionGraph, cognitiveHealth, handoffReplay |

- Config: `.contora/config/llm.json` (no secrets)
- Keys: `.contora/config/.llm-keys.json` (per-provider, gitignored)
- See [AI_LAYER.md](./AI_LAYER.md)

### Governance (V4)

Change review, scope resolution, decision provenance. Artifacts under `.contora/governance/`.

### Runtime Dashboard — Cognitive State TUI

Auto-attached terminal UI shared by IDE, MCP, and CLI bootstrap.

| View | Key | Content |
|------|-----|---------|
| A Live Cognition | default | Change · Health · Evolution streams |
| B Governance Overlay | | Policy snapshot · violations |
| C Debug Trace | Enter | Decision provenance (local lens) |
| D Project History | Enter | CIL feed · last 7 days (local lens) |
| E LLM Config | | Provider → API key → auto test |

See [DASHBOARD.md](./DASHBOARD.md).

---

## Architecture

```text
                 Query Layer (Ask)
                        │
                 Query Router
                        │
                 Cognitive Kernel          ← CIL v3
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  Event Engine   Decision Engine   State Engine
        │               │               │
        └───────┬───────┴───────┬───────┘
                ▼               ▼
         Action Engine    Module Projection
                │
                ▼
         IDE · MCP · CLI · Dashboard
                │
                ▼
           @contora/state-core (PIL + CIL + AI)
                │
                ▼
              .contora/
```

```text
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  IDE Extension  │   │  CLI + Dashboard│   │   MCP Server    │
│     (src/)      │   │ (packages/cli)  │   │ (packages/mcp)  │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               ▼
                  ┌────────────────────────┐
                  │  @contora/state-core   │
                  └───────────┬────────────┘
                              ▼
                    .contora/ (shared store)
```

**Monorepo layout:**

```text
contorium/
├── src/                 # VS Code / Cursor extension
├── packages/
│   ├── state-core/      # Shared PIL, CIL, AI, governance
│   ├── cli/             # Terminal commands + dashboard worker
│   ├── mcp/             # MCP stdio server
│   └── runtime/         # IDE-embedded runtime helpers
└── docs/
```

**Data pipeline:**

```text
IDE events / Git scan
  → change.json → graph.json → handoff.json → timeline.json
  → graph/knowledge.json → governance/*
  → IDE sidebar / MCP tools / CLI export / Dashboard
```

---

## Three peer runtimes

| Runtime | User | Primary loop | Unique strengths |
|---------|------|--------------|------------------|
| **IDE** | Developer in editor | Capture → Visualize → Transfer | Sidebar UI, event capture, BYOK SecretStorage, editor restore |
| **MCP** | AI Agent | Retrieve → Inspect → Transfer | Full tool surface, `store_memory`, handoff injection |
| **CLI** | Terminal / CI | Inspect → Audit → Transfer | Scripts, dashboard TUI, `contorium ai` setup |

All three are **independent processes** sharing `@contora/state-core` and `.contora/`. `source.lastWriter` records the last adapter that wrote state.

---

## Install · Use · Uninstall

### Prerequisites

- Node.js **18+**
- **Folder** workspace (not single-file only)
- From source: `npm install && npm run compile` at repo root

### IDE extension

| Install | Use | Uninstall |
|---------|-----|-----------|
| VSIX: `npm run vsix` → Install from VSIX | Set **Current focus** · **Transfer Context** · Cortex (History / Decisions / Ask) | Extensions → Uninstall → Reload |
| Marketplace: **Contorium** (`franklee-dev`) | `Ctrl+Shift+C` dashboard · Command palette `Contorium: …` | Remove `franklee-dev.contorium-*` from extensions folder if needed |
| Dev: F5 after `npm run compile` | `contora.cilAiEnabled` + Configure API key for CIL AI | |

Details: [IDE_EXTENSION.md](./IDE_EXTENSION.md)

### MCP (`@contorium/mcp`)

| Install | Use | Uninstall |
|---------|-----|-----------|
| `npm install -g @contorium/mcp` or build from source | Configure once in host MCP settings with `CONTORIUM_WORKSPACE` | Host-specific remove + `npm uninstall -g @contorium/mcp` |
| | Open Cursor / Claude / Codex — host **spawns MCP automatically** | |
| | Agent calls `inspect_*`, `transfer_*`, `ask_project`, … | |

Details: [MCP.md](./MCP.md) · [packages/mcp/README.md](../packages/mcp/README.md)

### CLI (`contorium`)

| Install | Use | Uninstall |
|---------|-----|-----------|
| Same repo: `npm run compile` | `contorium init .` · `sync` · `bootstrap` | `npm unlink -g contorium` if linked |
| Optional: `npm link` at repo root | `contorium ask` · `transfer` · dashboard keys **`c`** / **`i`** | No background service; `.contora/` not auto-deleted |

Details: [CLI.md](./CLI.md)

### Clear workspace data (optional, all adapters)

```bash
rm -rf .contora
```

---

## Command matrix (summary)

### PIL core

| Capability | CLI | MCP | IDE |
|------------|-----|-----|-----|
| Bootstrap | `contorium init` | bootstrap on start | Open folder |
| Sync | `contorium sync` | implicit / watch | Auto scan |
| Inspect state | `contorium inspect state` | `inspect_state` | Sidebar |
| Transfer context | `contorium transfer context [--copy]` | `transfer_context` | Transfer Context |
| Capture focus | `contorium capture focus --text "…"` | `capture_focus` | Current focus field |

### CIL user layer

| Capability | CLI | MCP |
|------------|-----|-----|
| Ask | `contorium ask "…"` | `ask_project` |
| History | `contorium history` | `get_project_history` |
| Decisions | `contorium decisions` | `get_decisions` |
| Next actions | `contorium next` | `get_next_actions` |
| Health | `contorium health` | `get_cognitive_health` |
| Unified transfer | `contorium transfer --mode=story\|essence\|…` | `transfer_project` |

### AI Layer

| Capability | CLI | MCP | IDE |
|------------|-----|-----|-----|
| Setup | `contorium ai setup [--provider …] [--enable]` | — | `contora.cilAiEnabled` + BYOK |
| Status | `contorium ai status` | `get_ai_status` | Developer → CIL AI Layer |
| Test | `contorium ai test` | `test_ai_connection` | Test CIL AI connection |
| Interactive config | Dashboard view **E** | — | — |

Providers: OpenAI · Anthropic · OpenRouter · Gemini · **DeepSeek** · Ollama (local)

### Handoff injection (new AI chat)

| Surface | Flow |
|---------|------|
| IDE | Auto prompt + status bar `[?]` |
| MCP | `get_handoff_injection_status` → `confirm_handoff_injection` |
| Dashboard | **`i`** or Enter when pending |

Legacy tool and command names remain supported — see [MCP.md](./MCP.md) and [CLI.md](./CLI.md).

---

## `.contora/` layout (key paths)

```text
.contora/
├── state.json              # Focus, notes, git snapshot
├── handoff.json            # CHP v1 AI handoff
├── change.json / graph.json / timeline.json
├── graph/knowledge.json    # Cognitive graph
├── cognitive-events/       # CIL event store
├── decisions/              # ADR records
├── lifecycle/              # Validity projection (schema v3)
│   ├── index.json
│   ├── review-queue.json
│   └── decisions/          # owner / verify / evidence meta
├── governance/             # V4 review + Validity graphs
│   ├── assumption_graph.json
│   ├── decision_dependency_graph.json
│   ├── dependency_baseline.json
│   └── dismissed_impact_alerts.json
├── config/
│   ├── llm.json            # LLM settings (no secrets)
│   └── .llm-keys.json      # Per-provider API keys (gitignored)
├── cache/llm/              # Optional LLM response cache
├── events/                 # IDE event log
└── mcp/                    # MCP store_memory (optional)
```

---

## Recommended combinations

| Scenario | Setup |
|----------|-------|
| Daily dev | IDE only |
| AI agent continuity | IDE + MCP |
| CI / audit | CLI `sync` + `export` + `governance` |
| Full stack | IDE + MCP + CLI — shared `.contora/`, auto dashboard |

---

## Related docs

| Topic | Document |
|-------|----------|
| Full install / uninstall | [INSTALL.md](./INSTALL.md) |
| IDE / CLI / MCP roles | [SURFACES.md](./SURFACES.md) |
| LLM explanation layer | [AI_LAYER.md](./AI_LAYER.md) |
| Dashboard TUI | [DASHBOARD.md](./DASHBOARD.md) |
| Operations guide | [PIL_RUNTIME.md](./PIL_RUNTIME.md) |
| CIL | [CIL.md](./CIL.md) |
| Knowledge Lifecycle | [LIFECYCLE.md](./LIFECYCLE.md) |
