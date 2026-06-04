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
| **Handoff (V3.1)** | `npx contorium handoff [path]` |
| **Cognitive summary** | `npx contorium graph-snapshot [path]` |
| **Knowledge graph** | `npx contorium knowledge [path]` |
| **Change / graph / timeline** | `npx contorium change\|graph\|timeline [path]` |
| **AI-ready export** | `npx contorium export [path]` or `--format json` |
| **Status** | `npx contorium status [path]` |
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
| `contorium sync [path]` | Rescan git + recent files | light sync |
| `contorium snapshot [path]` | Print PROJECT SNAPSHOT markdown | `get_project_snapshot` |
| `contorium status [path]` | JSON summary (mode, source, git counts) | — |
| `contorium state [path]` | Full `state.json` | `get_workspace_context` |

### V3.1 understanding layer

| Command | Purpose | MCP equivalent |
|---------|---------|----------------|
| `contorium handoff [path] [--format json\|markdown]` | AI handoff (**recommended execution entry**) | `get_project_handoff` |
| `contorium graph-snapshot [path]` | Cognitive summary | `get_project_graph_snapshot` |
| `contorium knowledge [path] [--min-confidence N]` | Knowledge graph (default filter 0.7) | `get_project_knowledge_graph` |
| `contorium change [path]` | `change.json` | `get_project_change` |
| `contorium graph [path]` | Change neighborhood `graph.json` | `get_project_graph` |
| `contorium timeline [path]` | `timeline.json` | `get_project_timeline` |
| `contorium export [path] [--format json\|markdown]` | Canonical export (aligned with IDE Copy) | combined tools |

**PowerShell:**

```powershell
cd E:\your-project
npx contorium init .
npx contorium sync .
npx contorium handoff .
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
npx contorium handoff .
npx contorium graph-snapshot .
npx contorium knowledge . --min-confidence 0.7
npx contorium export . > ai-context.md
npx contorium export . --format json > ai-context.json
```

Writes set `state.json` → `source.lastWriter: "cli"`.

### `contorium export` sections (markdown)

Uses the same `formatCanonicalAiMarkdown` as IDE **Copy AI-ready context**:

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
```

JSON format includes `cognitiveSnapshot` when the knowledge graph exists.

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

---

## Related docs

- [README](../README.md)
- [Install overview](./INSTALL.md)
- [IDE Extension](./IDE_EXTENSION.md)
- [MCP Server](./MCP.md)
- [Architecture V3.1](./ARCHITECTURE_V3.md)
- [Engineering Closure](./ENGINEERING_CLOSURE.md)
- [State Engine](./STATE_ENGINE.md)
