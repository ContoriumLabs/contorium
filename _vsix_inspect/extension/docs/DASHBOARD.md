# Contorium Runtime Dashboard

**Cognitive State** terminal UI — shared across **IDE**, **CLI**, and **MCP** via the same `.contora/` artifacts.

- [PIL Runtime Guide](./PIL_RUNTIME.md) · [INSTALL](./INSTALL.md) · [CLI](./CLI.md) · [MCP](./MCP.md)

---

## Design principles

| Principle | Implementation |
|-----------|----------------|
| **Zero commands (normal use)** | Bootstrap + dashboard attach are automatic |
| **Single source of truth** | `handoff.json` + `state.json` — not `dashboard.status.json` |
| **Dashboard is a view** | Worker reads artifacts; does not own business state |
| **Main content never clipped** | Cognitive core + dimensions + streams render in full |
| **Shortcuts footer** | Pinned at bottom; truncated first if terminal is too short |

---

## States

```text
Idle ──(runtime bootstrap)──► Cognitive State dashboard
  ▲                                    │
  └──────── session end ───────────────┘
```

| State | Display |
|-------|---------|
| **Idle** | `[○] Contorium waiting for IDE session…` |
| **Active** | Full-screen **Cognitive State** panel (alternate-screen TUI on CLI) |

There is **no compact/expand toggle**. When runtime is active, the full cognitive dashboard is shown.

---

## UI layout (Cognitive State)

```text
┌──────────────────────────────────────────────────────────────┐
│ CONTORIUM • Cognitive State                    [+] LIVE      │
│ Project: … | Agent: … | Stage: …                           │
│ Focus: … | Confidence: …                                   │
├──────────────────────────────────────────────────────────────┤
│ [+] STATE          │ [+] INTENT                             │
│ …                  │ …                                      │
├────────────────────┼─────────────────────────────────────────┤
│ [·] DECISION       │ [·] WHY                                │
│ …                  │ …                                      │
├──────────────────────────────────────────────────────────────┤
│ [+] Cognitive Streams                                      │
│ ▶ Change Stream / Cognitive Health / Evolution               │
├──────────────────────────────────────────────────────────────┤
│ View Mode: ● Live  ○ Gov  ○ Debug  ○ History  ○ LLM Config      │
├──────────────────────────────────────────────────────────────┤
│ Shortcuts                                                  │
│ [c]       Copy PIL context to clipboard                    │
│ [i]       Inject compact handoff to AI chat                 │
│ …                                                          │
└──────────────────────────────────────────────────────────────┘
```

| Region | Content |
|--------|---------|
| **Level 1 — Cognitive Core** | Project, agent, stage, focus, confidence |
| **Level 2 — Dimensions** | STATE · INTENT · DECISION · WHY (2×2 grid) |
| **Level 3 — Streams** | Change · Health · Evolution (content varies by view mode) |
| **View Mode** | Live · Governance · Debug · **Project History** · **LLM Config** |
| **Shortcuts** | Key bindings with descriptions (English) |

`[+]` / `[·]` markers indicate live vs static modules (fixed-width animation).

---

## View modes

| Mode | Selection | Content | Apply on Enter |
|------|-----------|---------|----------------|
| **A — Live Cognition** (default) | `↑↓` | Change · Health · Evolution streams | Yes — persisted to MCP |
| **B — Governance Overlay** | | Policy snapshot · violations · decision | Yes — persisted to MCP |
| **C — Debug Trace** | | Decision provenance · raw review | Preview only |
| **D — Project History** | | CIL cognitive event feed · last 7 days | Preview only |
| **E — LLM Config** | | Provider setup · API key · auto test | See [View E — LLM Config](#view-e--llm-config) |

- **`↑` / `↓`** — cycle view modes (A–E)  
- **`Enter`** — apply **A** or **B** to MCP runtime; **C** / **D** show preview flash only  

---

## View E — LLM Config

LLM configuration is **View Mode E** — the main streams region switches to the setup UI when E is selected (not a separate panel below View Mode).

**Sequential flow:**

```text
Step 1: Select provider (←→ cycle · Enter confirm)
   ↓
Step 2: Enter API key (type or Ctrl+V · Enter save & auto-test · Esc back)
   ↓
Auto connection test result shown in streams
```

| Provider | Key required |
|----------|--------------|
| OpenAI · Anthropic · OpenRouter · Gemini · DeepSeek | Yes — per-provider key in `.contora/config/.llm-keys.json` |
| Ollama (local) | No — tests after provider confirm |

**UI hints (English):**

- Configured providers show **`· configured`** in the provider list
- Unconfigured selection shows **`· key required`**
- Switching provider never reuses another provider's API key

**Keys in view E:**

| Key | Action |
|-----|--------|
| `↑` / `↓` | Cycle view modes |
| `←` / `→` or `h` | Cycle provider (step 1) |
| `Enter` | Confirm provider · save key and test (step 2) |
| `Ctrl+V` | Paste API key from clipboard (step 2) |
| `Esc` | Back to provider list (step 2) |

See [AI_LAYER.md](./AI_LAYER.md) for `llm.json`, CLI `contorium ai`, and IDE/MCP integration.

---

## Keyboard shortcuts (global)

| Key | Action |
|-----|--------|
| **`c`** | Copy PIL context (`transfer context`) |
| **`i`** | Inject compact handoff (when injection pending) |
| **`n`** | Skip injection (when pending) |
| **`q`** | Quit dashboard worker |
| **`↑` / `↓`** | Cycle view mode (A–E) |
| **`←` / `→`** | Cycle LLM provider (view E, step 1 only) |
| **`Enter`** | Apply view A/B · confirm provider or save key (view E) |

When the terminal is too short, the **Shortcuts** section truncates first and shows:

```text
Scroll or resize terminal to view all shortcuts
```

Main cognitive content is **never** truncated.

---

## Automatic triggers

| Source | When | Action |
|--------|------|--------|
| **MCP initialize** | AI host starts MCP | `bootstrap --source mcp` |
| **IDE workspace open** | Extension loads folder | `bootstrap --source ide` |
| **CLI init** | `contorium init` | `bootstrap --source cli` |
| **File / git change** | Save, sync, reactive sync | Artifact watch → dashboard refresh |

Users do **not** run `contorium dashboard attach` in normal workflows.

---

## IDE integration

- **Status bar** — compact CHP line from `handoff.json` + optional mini-graph  
- **Webview panel** — may mirror expanded frame from `dashboard.status.json`  
- Setting: `contora.autoAttachDashboard` (default `true`)

---

## Data sources

| UI region | Primary artifacts |
|-----------|-------------------|
| Cognitive Core | `state.json`, `handoff.json`, intelligence health |
| STATE | `state.json`, `change.json`, recent events |
| INTENT | intent graph, handoff goal/summary |
| DECISION / WHY | `governance/review.json`, decision graph, reason chains |
| Streams | events, timeline, evolution, impact, health metrics |

---

## Debug commands

| Command | Purpose |
|---------|---------|
| `contorium dashboard attach [path]` | Manual attach (dev) |
| `contorium dashboard once [path]` | Single-frame dump |

Normal users should rely on automatic bootstrap only.
