# PIL Runtime — Operations Guide (v3.0)

> **Contorium** is an **AI Project Intelligence Layer (PIL)**.  
> It captures, structures, preserves, retrieves, and transfers project intelligence across tools and sessions.  
> It does **not** execute work, orchestrate agents, or make project decisions.

Related: [Project Intelligence Layer](./PROJECT_INTELLIGENCE_LAYER.md) · [Language Spec](./CONTORIUM_LANGUAGE_SPEC.md) · [Install](./INSTALL.md)

---

## Responsibility chain

```text
Capture → Structure → Preserve → Retrieve → Transfer
```

| Phase | Meaning |
|-------|---------|
| **Capture** | Record focus, notes, decisions, workspace events |
| **Structure** | Build graphs, timelines, governance artifacts |
| **Preserve** | Persist under `.contora/` (local-first) |
| **Retrieve** | Inspect/query intelligence via IDE, MCP, or CLI |
| **Transfer** | Export compressed context for a new AI session |

---

## Intelligence model

### Core objects

| Object | Question | Typical artifacts |
|--------|----------|-------------------|
| **STATE** | What exists now? | `state.json`, working set, handoff |
| **INTENT** | Why does it exist? | intent graph, project goal |
| **DECISION** | How did it evolve? | decision graph, governance review |
| **WHY** | What is the reasoning? | reason chains, why layer |

### Dimensions & systems

| Layer | Question |
|-------|----------|
| **TIMELINE** | When did it change? |
| **IMPACT** | What does it affect? |
| **CONFIDENCE** | How trustworthy is this record? |
| **EVOLUTION** | How has the project transformed? |
| **PROVENANCE** | Why does this intelligence exist? |

---

## Three peer runtimes

IDE, MCP, and CLI are **equal PIL runtimes**. All share **`@contora/state-core`** and the same `.contora/` repository.

```text
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ IDE Extension│   │  MCP Server  │   │ CLI + TUI    │
│ Capture · UI │   │ Agent tools  │   │ Terminal ops │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          ▼
              @contora/state-core (PIL Core)
                          ▼
                   .contora/ (local repo)
```

| Runtime | Primary loop | Typical user |
|---------|--------------|--------------|
| **IDE** | Capture → Visualize → Transfer | VS Code / Cursor developer |
| **MCP** | Retrieve → Inspect → Transfer | Claude Code, Codex, Cursor Agent, Gemini CLI |
| **CLI** | Inspect → Audit → Transfer | Terminal, CI, headless automation |

---

## PIL capability groups (aligned across surfaces)

### Inspect — read records

| MCP tool | CLI command |
|----------|-------------|
| `inspect_state` | `contorium inspect state` |
| `inspect_intent` | `contorium inspect intent` |
| `inspect_decision` | `contorium inspect decision` |
| `inspect_timeline` | `contorium inspect timeline` |
| `inspect_graph` | `contorium inspect graph` |
| `inspect_confidence` | `contorium inspect confidence` |
| `inspect_impact` | `contorium inspect impact` |
| `inspect_evolution` | `contorium inspect evolution` |
| `inspect_provenance` | `contorium inspect provenance` |
| `inspect_health` | `contorium inspect health` |
| `inspect_why` | `contorium inspect why` |

IDE: sidebar panels (Project state, Intent graph, Knowledge graph, Governance) + command palette inspect-style actions.

### Transfer — export for AI continuity

| Name | MCP | CLI | IDE | Size |
|------|-----|-----|-----|------|
| **Transfer Context** | `transfer_context` | `contorium transfer context [--copy]` | Sidebar **Transfer Context** | ~300–800 tokens |
| **Transfer Intelligence** | `transfer_intelligence` | `contorium transfer intelligence [--copy]` | Sidebar **Transfer Intelligence** | ~8000 tokens |
| **Transfer Handoff** | `transfer_handoff` | `contorium transfer handoff [--copy]` | Runtime inject / handoff flow | ~100–300 tokens |

Legacy aliases remain: `get_cognitive_snapshot`, `snapshot copy`, `export intelligence`, etc.

### Capture — write records

| MCP | CLI | IDE |
|-----|-----|-----|
| `capture_focus` | `contorium capture focus --text "…"` | Sidebar **Current focus** |
| `capture_note` | `contorium capture note --text "…"` | Sidebar **Capture note** |
| `capture_decision` | `contorium capture decision --selected "…"` | Sidebar **Capture decision** |

---

## Typical workflows

### 1. Daily development (IDE-led)

1. Open a **folder workspace** in VS Code or Cursor with the Contorium extension.
2. Set **Current focus** in the sidebar (writes `state.json` via PIL Capture).
3. Edit code — scanner + cognition pipeline update `.contora/` artifacts.
4. On a new AI chat: use **Transfer Context** or confirm **Runtime handoff** injection when prompted.
5. Optional: open the **Runtime Dashboard** terminal panel (auto-started on workspace open).

### 2. Agent session (MCP-led)

1. Configure `@contorium/mcp` once in your AI host (Codex, Claude Code, Cursor, etc.).
2. Host spawns MCP on session start → bootstrap writes/merges `.contora/`.
3. Agent calls **`inspect_*`** to read project intelligence before acting.
4. Agent calls **`transfer_context`** or **`transfer_handoff`** when starting a fresh chat thread.
5. Agent may call **`capture_focus`** / **`capture_note`** to persist session conclusions.

### 3. Terminal / CI (CLI-led)

```bash
contorium init .
contorium sync .
contorium inspect health .
contorium transfer context --copy
contorium decision derive .    # governance / provenance pipeline
contorium bootstrap . --source cli
```

Dashboard worker attaches automatically after bootstrap (see [DASHBOARD.md](./DASHBOARD.md)).

---

## Local repository (`.contora/`)

```text
.contora/
├── state.json
├── handoff.json
├── state/
├── intent/
├── decision/
├── timeline/
├── graph/
├── confidence/
├── provenance/
├── evolution/
├── intelligence/
├── governance/
├── events/
└── mcp/
```

No cloud backend. No vendor lock-in.

---

## Runtime dashboard (Cognitive State UI)

When IDE or MCP bootstraps a workspace, a dashboard worker renders a **Cognitive State** terminal view:

| Region | Content |
|--------|---------|
| **Cognitive Core** | Project, agent, stage, focus, confidence |
| **Dimensions** | STATE · INTENT · DECISION · WHY (2×2 grid) |
| **Streams** | Change · Health · Evolution (or Governance/Debug lens) |
| **View Mode** | Live · Governance · Debug · **Project History** · **LLM Config** |
| **Shortcuts** | Fixed footer with key bindings |

Keys: **`c`** copy context · **`i`** inject handoff · **`q`** quit · **`↑↓`** view mode · **`←→`** LLM provider (view E) · **`Enter`** apply mode / confirm provider / save key.

See [DASHBOARD.md](./DASHBOARD.md) · [AI_LAYER.md](./AI_LAYER.md).

---

## Governance (optional layer)

Governance evaluates **changes against project rules** — it does not replace PIL capture/transfer.

- Artifacts: `.contora/governance/` (review, decision, scope, trace)
- IDE: **Review Change**, **View Rules**, **Edit Direction**
- MCP: `run_governance_cycle`, `ensure_control_ready`, …
- CLI: `contorium decision derive`, `contorium governance …`

---

## What Contorium is not

- Not an autonomous coding agent  
- Not a task runner or recommendation engine  
- Not a substitute for developer judgment  

> **Contorium records and preserves project intelligence. It does not decide for the project.**
