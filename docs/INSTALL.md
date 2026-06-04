# Contorium — Install, Use, and Uninstall (Three Adapters)

> Back to [README](../README.md) · Per adapter: [IDE](./IDE_EXTENSION.md) · [MCP](./MCP.md) · [CLI](./CLI.md)

Contorium v2.2+: **IDE, MCP, and CLI are peer Runtime Adapters** sharing `@contora/state-core` and the project-local `.contora/` directory.  
Any adapter can bootstrap and maintain state independently; combined use merges via `source.mode: merged`.

| Adapter | Typical user | Standalone capability |
|---------|--------------|----------------------|
| **IDE** | VS Code / Cursor developers | Events, sidebar, one-click copy, BYOK |
| **MCP** | Claude Code / Cursor Agent / Codex / Gemini | Bootstrap, 5s + event sync, 18 MCP tools |
| **CLI** | Terminal / CI / headless | `init` / `sync` / `handoff` / `knowledge` / `export` |

**Public API unchanged:** `state.json` fields remain backward compatible; MCP tool names and extension command IDs are stable. v2.2+ adds optional `source` metadata.

---

## Prerequisites (all adapters)

| Requirement | Notes |
|-------------|-------|
| Node.js | **18+** (MCP / CLI / source build) |
| Workspace | Real project **folder** path |
| Build (from source) | Repo root: `npm install && npm run compile` |

Artifact layout:

```text
.contora/                    # shared by all adapters
├── state.json               # + source { mode, lastWriter, lastUpdated }
├── state-builder/           # L4 snapshot (scan or IDE cognition pipeline)
├── graph/                   # V3.1 cognitive graph (knowledge.json, snapshot.json, …)
├── events/                  # IDE events (CLI/MCP read; IDE writes)
└── mcp/                     # MCP store_memory (optional)
```

---

## Install

### IDE extension

| Method | Steps |
|--------|-------|
| VSIX (recommended) | Download Release or `npm run vsix` → Extensions → **Install from VSIX** → Reload |
| Marketplace | Search **Contorium** (`franklee-dev`) |
| Development | `npm run compile` → F5 Extension Development Host |

See [IDE_EXTENSION.md](./IDE_EXTENSION.md).

### MCP server

```bash
git clone https://github.com/ContoriumLabs/contorium.git
cd contorium
npm install
npm run compile          # or npm run build:mcp
```

Configure host (**use absolute paths on your machine**):

```json
{
  "mcpServers": {
    "contorium": {
      "command": "node",
      "args": ["E:/path/to/contorium/bin/contorium-mcp-launch.cjs"],
      "env": {
        "CONTORIUM_WORKSPACE": "E:/path/to/your-project"
      }
    }
  }
}
```

| Host | Setup |
|------|-------|
| Cursor | Settings → MCP → enable `contorium` |
| Claude Code | `claude mcp add ...` or `claude --plugin-dir .` |
| Codex | `codex mcp add contorium -- node .../contorium-mcp-launch.cjs` |
| Gemini CLI | `~/.gemini/settings.json` → `mcpServers.contorium` |

See [MCP.md](./MCP.md).

### CLI

Ships with the same repo — no separate npm publish:

```bash
npm install
npm run compile
npx contorium --help
npx contorium init .
```

Optional global link (repo root): `npm link` → `contorium status .`

See [CLI.md](./CLI.md).

---

## Usage scenarios

### IDE only

1. Install extension → open a **folder** workspace  
2. Set **Current focus** in the sidebar, code normally  
3. **Copy AI-ready context** into any AI chat  

No MCP or CLI required.

### MCP only

1. `npm run compile`  
2. Configure MCP with `CONTORIUM_WORKSPACE` pointing at project root  
3. Start Agent — MCP **bootstraps** `.contora/` if missing  
4. Call `get_project_handoff` / `get_project_graph_snapshot` / `get_project_snapshot`  

No IDE; scan/merged mode is less precise without IDE events.

### CLI only

```bash
cd /path/to/your-project
npx contorium init .
npx contorium sync .
npx contorium snapshot .
npx contorium handoff .
npx contorium graph-snapshot .
npx contorium knowledge .
npx contorium export .
npx contorium status .
npx contorium state .
```

No IDE or MCP; suitable for CI and scripts.

### Combined (recommended)

| Combo | Effect |
|-------|--------|
| IDE + MCP | IDE writes events + cognitive graph; MCP reads handoff / graph-snapshot |
| IDE + CLI | IDE daily; CLI `export` or `graph-snapshot` in CI |
| All three | `source.lastWriter` tracks last writer; task/notes are not overwritten |

---

## Command matrix (V3.1)

| Capability | IDE | MCP | CLI |
|------------|-----|-----|-----|
| Bootstrap `.contora/` | Open folder | Bootstrap on start | `contorium init` |
| Refresh git/paths | Auto scan | 5s + events/git watch | `contorium sync` |
| Read state | Sidebar | `get_workspace_context` | `contorium state` |
| L4 snapshot | Sidebar / copy | `get_project_snapshot` | `contorium snapshot` |
| **AI execution entry** | Copy includes handoff | `get_project_handoff` | `contorium handoff` |
| **Cognitive summary** | `# COGNITIVE SNAPSHOT` in copy | `get_project_graph_snapshot` | `contorium graph-snapshot` |
| **Knowledge graph** | AI Cortex sidebar | `get_project_knowledge_graph` | `contorium knowledge` |
| Change / graph / timeline | Cortex | `get_project_change/graph/timeline` | `contorium change/graph/timeline` |
| Status summary | Sidebar | tool JSON | `contorium status` |
| Write task/notes | Sidebar | — | — |
| Agent memory | — | `store_memory` | — |
| Canonical Markdown export | Copy AI-ready context | — | `contorium export` |

**Backward compatible:** extension command IDs, existing MCP tool names, `state.json` fields.

**V3.1 additions:** `.contora/graph/` artifacts, MCP `get_project_knowledge_graph` / `get_project_graph_snapshot`, CLI `knowledge` / `graph-snapshot`, export `# COGNITIVE SNAPSHOT`.

---

## Uninstall

### IDE

Extensions → Contorium → **Uninstall** → Reload Window

Manual (if corrupted):

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.cursor\extensions\franklee-dev.contorium-*" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:USERPROFILE\.vscode\extensions\franklee-dev.contorium-*" -ErrorAction SilentlyContinue
```

### MCP

| Host | Command |
|------|---------|
| Cursor | Settings → MCP → remove `contorium` |
| Claude Code | `claude mcp remove contorium` |
| Codex | `codex mcp remove contorium` |
| Gemini | Remove `mcpServers.contorium` from settings.json |

### CLI

```bash
npm unlink -g contorium   # if you ran npm link
```

No background service. `.contora/` is **not** deleted automatically.

### Clear workspace data (optional, all adapters)

**PowerShell (project root):**

```powershell
Remove-Item -Recurse -Force .contora -ErrorAction SilentlyContinue
```

**macOS / Linux:**

```bash
rm -rf .contora
```

---

## `contorium init` output

When `.contora/state.json` already exists with events:

```json
{
  "workspaceRoot": "E:\\your-project",
  "created": false,
  "updated": true,
  "mode": "merged",
  "source": { "mode": "merged", "lastWriter": "cli" }
}
```

| Field | Meaning |
|-------|---------|
| `created: false` | **Normal** — merged existing state, not first create |
| `mode: merged` | Events + state present; scan supplements git/paths only |
| `updated: true` | State or snapshot written this run |

First-time init: `created: true`, `mode: scan-driven`.

---

## Related docs

- [README](../README.md)
- [IDE Extension](./IDE_EXTENSION.md)
- [MCP Server](./MCP.md)
- [CLI](./CLI.md)
- [Architecture V3.1](./ARCHITECTURE_V3.md)
- [Engineering Closure (frozen)](./ENGINEERING_CLOSURE.md)
- [State Engine](./STATE_ENGINE.md)
