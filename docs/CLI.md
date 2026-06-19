# Contorium CLI

The CLI is a **peer Runtime Adapter** with IDE and MCP, sharing `@contora/state-core` and `.contora/`.  
Overview: [INSTALL.md](./INSTALL.md) · [README](../README.md)

---

## Command cheat sheet

| Phase | Command |
|-------|---------|
| **Install** | `npm install && npm run compile` (contorium repo root) |
| **Verify** | `npx contorium status .` or `npx contorium --help` |
| **Global (optional)** | Repo root `npm link` → `contorium status .` anywhere |
| **Init** | `npx contorium init [path]` |
| **Refresh** | `npx contorium sync [path]` |
| **L4 snapshot** | `npx contorium snapshot [path]` |
| **Handoff (CHP v1)** | `npx contorium handoff` · `--copy-to-ai` (manual copy) |
| **Dashboard** | **No command** — auto Passive; **Space** → Expanded |
| **Semi-auto inject** | **No command** — auto on new AI chat; debug: `--prompt-new-chat` |
| **Cognitive summary** | `npx contorium graph-snapshot [path]` |
| **Knowledge graph** | `npx contorium knowledge [path]` |
| **Change / graph / timeline** | `npx contorium change\|graph\|timeline [path]` |
| **AI-ready export** | `npx contorium export [path]` or `--format json` |
| **Governance review** | `npx contorium governance review [path] --target <file>` |
| **Governance cycle** | `npx contorium governance cycle [path] [--target <file>]` |
| **Governance export** | `npx contorium governance export [path] [--copy]` |
| **Control surface** | `npx contorium control governance\|check\|intent\|analyze\|execute\|ready [path]` |
| **Runtime bootstrap** | `npx contorium bootstrap [path] [--source ide\|mcp\|cli]` |
| **Status** | `npx contorium status [path]` |
| **Runtime dashboard** | Zero CLI commands — edit files → auto Passive (see below) |
| **state.json** | `npx contorium state [path]` |
| **Uninstall** | `npm unlink -g contorium` (if linked); no daemon |
| **Clear data (optional)** | `Remove-Item -Recurse -Force .contora` (PowerShell) |

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

### Runtime dashboard (CRBP — automatic, zero commands)

When Codex / Claude / Gemini **starts Contorium MCP**, the server runs bootstrap and attaches a Passive dashboard worker. **You never run attach or handoff --show in normal use.**

| What | How (no command) |
|------|------------------|
| **Passive line** | Appears automatically in Contorium terminal / IDE status bar |
| **Expanded view** | Press **Space** in the Contorium dashboard terminal |
| **Semi-auto inject** | New AI chat → `[?]` on Passive line → **Enter/i** or **n** |
| **Copy To AI** | Press **c** in dashboard terminal |

See [DASHBOARD.md](./DASHBOARD.md).

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

### Governance (`.contora/governance/*`)

Unified artifacts under `.contora/governance/` — see [INSTALL.md](./INSTALL.md#architecture-three-adapters).

| Command | Purpose | Writes |
|---------|---------|--------|
| `contorium governance review [path] --target <file>` | Run governance review on a target file | `review.json` only |
| `contorium governance cycle [path] [--target <file>]` | Full governance cycle (calls MCP dist when available) | decision, scope, trace, cycle |
| `contorium governance export [path] [--copy]` | Export governance appendix; `--copy` to clipboard | — |

**PowerShell:**

```powershell
npx contorium governance review . --target src/foo.ts
npx contorium governance cycle .
npx contorium governance export . --copy
```

### Control surface (control-core)

Mirrors MCP auxiliary governance tools:

| Command | Purpose | MCP equivalent |
|---------|---------|----------------|
| `contorium control governance [path]` | Read governance rules | `get_control_context` |
| `contorium control check [path] --target <file>` | Review an action | check via governance engine |
| `contorium control intent [path] "<text>"` | Update project direction | `update_project_intent` |
| `contorium control analyze [path]` | Analyze project | `analyze_project` |
| `contorium control execute [path] --target <file>` | Validate governance loop | — |
| `contorium control ready [path]` | Bootstrap governance + sync | `ensure_control_ready` |

Legacy aliases also work: `get-governance`, `check-action`, `update-project-intent`.

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
- [Runtime Dashboard (CRBP)](./DASHBOARD.md)
- [Architecture V3.1](./ARCHITECTURE_V3.md)
- [Engineering Closure](./ENGINEERING_CLOSURE.md)
- [State Engine](./STATE_ENGINE.md)
