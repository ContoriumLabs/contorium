# Contorium CLI

The CLI is a **peer PIL Runtime** with IDE and MCP, sharing `@contora/state-core` and `.contora/`.

- [PIL Runtime Guide](./PIL_RUNTIME.md) · [INSTALL](./INSTALL.md) · [README](../README.md) · [Overview](./OVERVIEW.md) · [Dashboard](./DASHBOARD.md)

---

## PIL commands (v3.0 — primary)

Three capability groups mirror MCP and IDE:

### Inspect

```bash
contorium inspect state|intent|decision|timeline|graph|confidence|impact|evolution|provenance|health|why|handoff [path]
```

### Transfer

```bash
contorium transfer context [path] [--format json|markdown] [--copy]
contorium transfer intelligence [path] [--copy]
contorium transfer handoff [path] [--copy]
```

### Capture

```bash
contorium capture focus [path] --text "<focus>"
contorium capture note [path] --text "<note>"
contorium capture decision [path] --selected "<choice>" [--reason "..."]
```

Legacy aliases: `snapshot copy` → `transfer context` · `export intelligence` → `transfer intelligence`

---

## Command cheat sheet

| Phase | Command |
|-------|---------|
| **PIL Inspect** | `contorium inspect state\|health\|intent\|… [path]` |
| **PIL Transfer** | `contorium transfer context\|intelligence\|handoff [path] [--copy]` |
| **PIL Capture** | `contorium capture focus\|note\|decision [path] --text …` |
| **Install** | `npm install && npm run compile` (contorium repo root) |
| **Verify** | `npx contorium status .` or `npx contorium --help` |
| **Init** | `npx contorium init [path]` |
| **Refresh** | `npx contorium sync [path]` |
| **Knowledge Lifecycle** | `contorium lifecycle` · `contorium review` · `contorium lifecycle owner\|verify <id>` |
| **Bootstrap** | `npx contorium bootstrap [path] [--source ide\|mcp\|cli]` |
| **Dashboard** | Automatic after bootstrap — Cognitive State TUI (see [DASHBOARD.md](./DASHBOARD.md)) |
| **Decision derive** | `npx contorium decision derive [path]` |
| **Governance** | `npx contorium governance review\|cycle\|export [path]` |
| **Legacy export** | `npx contorium export [path]` · `npx contorium handoff --copy-to-ai` |

Default `[path]` is the current directory.

---

## Install

### From source (same repo as MCP)

```bash
git clone https://github.com/ContoriumLabs/contorium.git
cd contorium
npm install
npm run compile
```

Verify:

```powershell
npx contorium status .
npx contorium init .
```

### Global command (optional)

From contorium repo root:

```bash
npm link
contorium status E:\path\to\your-project
```

---

## Commands

### Basics

| Command | Purpose | MCP equivalent |
|---------|---------|----------------|
| `contorium init [path]` | Create/merge `state.json`, L4 snapshot | bootstrap |
| `contorium bootstrap [path] [--source ide\|mcp\|cli]` | Runtime attach + dashboard worker | MCP initialize |
| `contorium sync [path]` | Rescan git + recent files | light sync |
| `contorium snapshot [path]` | Print PROJECT SNAPSHOT markdown | `get_project_snapshot` |
| `contorium status [path]` | JSON summary (mode, source, git counts) | — |
| `contorium state [path]` | Full `state.json` | `get_workspace_context` |

### Runtime dashboard (automatic)

When MCP or IDE bootstraps the workspace, a **Cognitive State** dashboard worker attaches to the terminal. No manual `attach` in normal use.

| Action | Key / behavior |
|--------|----------------|
| Copy context | **`c`** |
| Inject handoff | **`i`** or **Enter** (when injection pending) |
| Quit | **`q`** |
| View mode | **`↑` / `↓`** — Live · Governance · Debug · History · **LLM Config** |
| LLM provider (view E) | **`←` / `→`** or **`h`** — cycle provider · **Enter** confirm |
| LLM API key (view E step 2) | Type or **Ctrl+V** · **Enter** save & test · **Esc** back |
| Apply cognitive mode | **Enter** — A/B persist · C/D/E preview (E uses provider/key flow) |

See [DASHBOARD.md](./DASHBOARD.md) and [AI_LAYER.md](./AI_LAYER.md).

### AI Layer (CLI)

```bash
contorium ai setup [path] [--provider openai|anthropic|open_router|gemini|deepseek|ollama] [--model MODEL] [--enable]
contorium ai status [path] [--json]
contorium ai test [path] [--json]
```

### Runtime dashboard commands (debug / dev only)

| Command | Purpose |
|---------|---------|
| `contorium handoff --show` | Force expand signal (normally use **Space**) |
| `contorium handoff --hide` | Minimize to Passive |
| `contorium handoff --prompt-new-chat` | Force inject prompt in TTY (normally automatic) |
| `contorium handoff --copy` / `--copy-to-ai` | Manual clipboard copy |
| `contorium attach . --auto` | Start worker manually |

### Dashboard subcommands (debug / dev only)

| Command | Purpose |
|---------|---------|
| `contorium dashboard show` | Force expand signal |
| `contorium dashboard hide` | Minimize to Passive |
| `contorium dashboard line` | Print Passive line to stdout |
| `contorium dashboard wake` | Wake worker and refresh |
| `contorium dashboard open` | Open dashboard terminal |
| `contorium dashboard filter [symbol]` | Set or clear symbol filter |

### V3.1 understanding layer

| Command | Purpose | MCP equivalent |
|---------|---------|----------------|
| `contorium handoff [path] [--format compact\|markdown\|json]` | **CHP v1 get_handoff** (default: compact one-liner) | `get_project_handoff` |
| `contorium handoff --show \| --hide \| --filter` | Dashboard signals (**debug** — use **Space** instead) |
| `contorium handoff --prompt-new-chat` | Force inject prompt (**debug** — normally automatic) |
| `contorium graph-snapshot [path]` | Cognitive summary | `get_project_graph_snapshot` |
| `contorium knowledge [path] [--min-confidence N]` | Knowledge graph (default filter 0.7) | `get_project_knowledge_graph` |
| `contorium change [path]` | `change.json` | `get_project_change` |
| `contorium graph [path]` | Change neighborhood `graph.json` | `get_project_graph` |
| `contorium timeline [path]` | `timeline.json` | `get_project_timeline` |
| `contorium export [path] [--format json\|markdown]` | Unified export (handoff + governance appendix) | combined tools |

### Decision Provenance (advanced)

Unified artifacts under `.contora/governance/` — see [INSTALL.md](./INSTALL.md#architecture-three-adapters).

| Command | Purpose | Writes |
|---------|---------|--------|
| `contorium decision derive [path] [--target <file>]` | Derive decision provenance chain | decision, scope, trace, cycle |
| `contorium decision snapshot [path] [--target <file>]` | Project decision snapshot (alias of derive) | same as derive |
| `contorium decision synthesize [path] [--copy]` | Synthesize cognition export; `--copy` to clipboard | — |
| `contorium understand [path] --target <file>` | Change understanding for scope | `review.json` only |

**PowerShell:**

```powershell
npx contorium understand . --target src/foo.ts
npx contorium decision derive .
npx contorium decision synthesize . --copy
```

### Cognition inspect (preferred)

| Command | Purpose | MCP equivalent |
|---------|---------|----------------|
| `contorium cognition inspect governance [path]` | Inspect decision provenance rules | `get_decision_context` |
| `contorium cognition inspect check [path] --target <file>` | Change understanding check | check via governance engine |
| `contorium cognition inspect intent [path] "<text>"` | Record project direction | `record_project_intent` |
| `contorium cognition inspect analyze [path]` | Project cognition snapshot | `analyze_project` |
| `contorium cognition inspect health [path]` | Derive intelligence health & coverage | `get_project_intelligence_health` |
| `contorium cognition inspect ready [path]` | Verify provenance layer ready | `inspect_cognition_ready` |

Legacy aliases: `contorium control …` · `contorium inspect …` · `contorium system-inspection …`

### Governance (legacy path)

| Command | Purpose | Preferred replacement |
|---------|---------|----------------------|
| `contorium governance review [path] --target <file>` | Change understanding | `contorium understand` |
| `contorium governance cycle [path] [--target <file>]` | Full provenance derive | `contorium decision derive` |
| `contorium governance export [path] [--copy]` | Synthesize export | `contorium decision synthesize` |

### Control surface (legacy — control-core)

| Command | Purpose | Preferred replacement |
|---------|---------|----------------------|
| `contorium control governance [path]` | Read governance rules | `cognition inspect governance` |
| `contorium control check [path] --target <file>` | Review an action | `cognition inspect check` |
| `contorium control intent [path] "<text>"` | Update project direction | `cognition inspect intent` |
| `contorium control analyze [path]` | Analyze project | `cognition inspect analyze` |
| `contorium control ready [path]` | Bootstrap governance + sync | `cognition inspect ready` |

**PowerShell:**

```powershell
cd E:\your-project
npx contorium init .
npx contorium sync .
npx contorium handoff
npx contorium handoff --copy
npx contorium handoff --prompt-new-chat
npx contorium handoff --show
npx contorium handoff --format markdown
npx contorium graph-snapshot .
npx contorium knowledge . --min-confidence 0.7
npx contorium export . | Out-File -Encoding utf8 ai-context.md
npx contorium export . --format json | Out-File -Encoding utf8 ai-context.json
```

**bash:**

```bash
cd /path/to/project
npx contorium init .
npx contorium sync .
npx contorium handoff
npx contorium handoff --copy
npx contorium handoff --prompt-new-chat
npx contorium handoff --show
npx contorium handoff --format markdown
npx contorium graph-snapshot .
npx contorium knowledge . --min-confidence 0.7
npx contorium export . > ai-context.md
npx contorium export . --format json > ai-context.json
```

Writes set `state.json` → `source.lastWriter: "cli"`.

### CHP v1 — unified handoff (recommended)

Runtime maintains a single AI handoff state (`.contora/handoff.json` + `state.json`). All clients read via **get_handoff**:

| Client | How (normal — no command) |
|--------|---------------------------|
| **CLI Passive** | Auto line: `task \| last \| agent` + optional `⤷` mini-graph |
| **IDE status bar** | Same compact line; auto dialog when new chat + runtime active |
| **New AI chat** | Auto `[?]` prompt → Enter/i · n · or Agent asks Y/n |
| **Expanded dashboard** | **Space** in terminal (not `--show`) |
| **Manual copy** | **c** in terminal · `--copy-to-ai` · IDE Copy AI-ready context |

### Semi-auto inject (automatic)

When runtime is active and you open a **new AI chat**, Contorium shows `[?]` automatically.

**Debug (TTY fallback):**

```powershell
npx contorium handoff --prompt-new-chat
npx contorium handoff --copy-to-ai
```

**PowerShell one-liner (fallback only):**

```powershell
npx contorium handoff --copy
npx contorium export . | Out-File -Encoding utf8 ai-context.md
```

### `contorium export` sections (markdown)

Uses the same canonical export as IDE **Copy AI-ready context**, plus a unified **GOVERNANCE:** appendix when governance artifacts exist:

```text
# TASK ANCHOR
# PROJECT SNAPSHOT
# WORKING CONTEXT
# COGNITIVE SNAPSHOT
# CHANGE SET / IMPACT SET
# AI HANDOFF (V3.1)
# CODE EVOLUTION
# NOTES
# INSTRUCTION
---
GOVERNANCE:
## DECISION
## SCOPE
## TRACE
```

Dashboard **c** key, `contorium handoff --copy`, and `contorium governance export` use the same unified export builder from `@contora/state-core`.

JSON format includes `cognitiveSnapshot` when the knowledge graph exists, and `governance_export` when governance artifacts exist.

---

## Relationship to IDE / MCP

- Does **not** require IDE extension or MCP process  
- With IDE: IDE writes events; CLI `sync` supplements git/paths only — **does not overwrite** `currentTask` / `notes`  
- With MCP: shares `syncWorkspaceState()` logic  

---

## Uninstall

1. If you ran `npm link`: `npm unlink -g contorium`  
2. Stop calling `contorium`; `.contora/` is **not** removed  

Clear shared workspace data:

```powershell
Remove-Item -Recurse -Force .contora
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `command not found: contorium` | Run `npm run compile`, use `npx contorium` |
| `init` shows `created: false` | **Normal** — existing state; check `updated` and `source` |
| Generic snapshot | Without IDE events, scan-only inference; use extension for precision |
| `knowledge` / `graph-snapshot` missing | Needs code changes; run `sync` or save files in IDE |
| `state: no state.json` | Run `npx contorium init .` first |
| Copy missing `GOVERNANCE:` block | Run `governance review` or `governance cycle` first; restart dashboard worker after CLI rebuild |
| Dashboard shows stale UI | Run `npm run build:cli` then restart dashboard worker |

---

## Related docs

- [README](../README.md)
- [Install overview](./INSTALL.md)
- [IDE Extension](./IDE_EXTENSION.md)
- [MCP Server](./MCP.md)
- [Runtime Dashboard](./DASHBOARD.md)
- [Knowledge Lifecycle](./LIFECYCLE.md)
