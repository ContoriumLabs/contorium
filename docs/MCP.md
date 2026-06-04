# Contorium MCP Server

stdio MCP server for **Claude Code, Cursor Agent, OpenAI Codex, Gemini CLI**, and other MCP hosts.  
**v2.2+ standalone:** bootstraps `.contora/` without IDE; **5s polling + events/git triggers** for sync.  
Overview: [INSTALL.md](./INSTALL.md) · [README](../README.md) · [Architecture V2.2](./ARCHITECTURE_V2_2.md)

---

## Command cheat sheet

| Phase | Command / action |
|-------|------------------|
| **Build** | `git clone … && cd contorium && npm install && npm run compile` |
| **Verify** | `set CONTORIUM_WORKSPACE=E:\your-project` then `node bin/contorium-mcp-launch.cjs` (expect `ready on stdio`) |
| **Cursor** | Settings → MCP → enable `contorium` (JSON below) |
| **Claude Code** | `claude mcp add --scope project contorium -- node E:/path/to/contorium/bin/contorium-mcp-launch.cjs` |
| **Codex** | `codex mcp add contorium -- node E:/path/to/contorium/bin/contorium-mcp-launch.cjs` |
| **Daily use** | Agent calls `get_project_handoff` / `get_project_graph_snapshot` / `store_memory` |
| **Remove Cursor** | Settings → MCP → delete `contorium` |
| **Remove Claude** | `claude mcp remove contorium` |
| **Remove Codex** | `codex mcp remove contorium` |
| **Clear MCP memory (optional)** | `Remove-Item -Recurse -Force .contora\mcp` (PowerShell, project root) |

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js | **18+** (matches extension build) |
| Workspace | Real project directory |
| Extension (recommended) | [IDE extension](./IDE_EXTENSION.md) for event-driven State Engine; MCP bootstraps without it |
| Build | Run `npm run compile` (or `npm run build:mcp`) before first use |

---

## Install MCP

### Build from source

From **contorium repo root**:

```bash
git clone https://github.com/ContoriumLabs/contorium.git
cd contorium
npm install
npm run compile
```

Artifacts:

- Entry: `packages/mcp/dist/server.js`
- Launcher: `bin/contorium-mcp-launch.cjs` (recommended for absolute paths)

Verify:

```bash
node packages/mcp/dist/server.js
# Expect [contorium-mcp] ready on stdio, then wait (Ctrl+C to exit)
```

### Cursor IDE

**Option A — repo `mcp.json` (local clone)**

1. Open contorium repo in Cursor or merge config into `.cursor/mcp.json` / user MCP settings  
2. Set `args` to your **absolute path** to `packages/mcp/dist/server.js`  
3. Set `CONTORIUM_WORKSPACE` to **your project root** (not the contorium repo unless you work there)

```json
{
  "mcpServers": {
    "contorium": {
      "command": "node",
      "args": ["E:/your-project/path/to/contorium/packages/mcp/dist/server.js"],
      "env": {
        "CONTORIUM_WORKSPACE": "E:/your-actual-workspace"
      }
    }
  }
}
```

4. **Cursor → Settings → MCP** → enable `contorium` → Reload Window / restart Agent

**Option B — portable launcher (spaces or cross-directory paths)**

```json
{
  "mcpServers": {
    "contorium": {
      "command": "node",
      "args": ["E:/path/to/contorium/bin/contorium-mcp-launch.cjs"],
      "env": {
        "CONTORIUM_WORKSPACE": "E:/your-actual-workspace"
      }
    }
  }
}
```

### Claude Code

**Plugin (recommended, uses `.mcp.claude.json`):**

```bash
cd /path/to/contorium
npm run build:mcp
claude --plugin-dir .
```

**MCP only (project scope):**

```bash
cd /path/to/your-workspace
claude mcp add --scope project contorium -- node /path/to/contorium/bin/contorium-mcp-launch.cjs
```

Environment (plugin may inject):

- `CONTORIUM_WORKSPACE` — workspace root  
- `CLAUDE_PROJECT_DIR` / `CLAUDE_PROJECT_ROOT` — Claude Code project dir  

### OpenAI Codex

```bash
cd /path/to/contorium
npm run build:mcp
codex mcp add contorium -- node ./bin/contorium-mcp-launch.cjs
```

Or use [`.mcp.json`](../.mcp.json) and [`.codex-plugin/plugin.json`](../.codex-plugin/plugin.json).

### Gemini CLI

Add to `~/.gemini/settings.json` or project `.gemini/settings.json` (**absolute paths**):

```json
{
  "mcpServers": {
    "contorium": {
      "command": "node",
      "args": ["/absolute/path/to/contorium/bin/contorium-mcp-launch.cjs"],
      "env": {
        "CONTORIUM_WORKSPACE": "/absolute/path/to/your-workspace"
      }
    }
  }
}
```

Restart Gemini CLI session after changes.

### MCP Inspector (debug)

```bash
npx @modelcontextprotocol/inspector node packages/mcp/dist/server.js
```

Invoke tools in the browser; confirm `workspaceRoot` and JSON responses.

---

## Using MCP

### Tool list

| Tool | R/W | Description |
|------|-----|-------------|
| `store_memory` | W | Persist to `.contora/mcp/memories.json` |
| `search_memory` | R | Keyword search MCP memory |
| `get_memory` | R | Read by key |
| `get_workspace_context` | R | `state.json` (focus, Git, files) |
| `get_project_intelligence` | R | L5 `intelligence/state-summary.json` |
| `get_intent_graph` | R | Full L5 intent graph |
| `get_active_intents` | R | Active intent node summary |
| `get_project_state` | R | L4 `state-builder/project-state.json` |
| `get_project_snapshot` | R | L4 Markdown snapshot; optional `format=json` |
| `get_state_conflicts` | R | v2 unresolved conflicts (audit only) |
| `get_project_graph` | R | V3.1 change neighborhood `.contora/graph.json` |
| `get_project_change` | R | V3.1 change semantics `.contora/change.json` |
| `get_project_handoff` | R | **V3.1 recommended AI execution entry** `.contora/handoff.json` |
| `get_project_timeline` | R | V3.1 code evolution `.contora/timeline.json` |
| `get_project_knowledge_graph` | R | V3.1 cognitive graph; default `minConfidence` 0.7; optional `includeInference` |
| `get_project_graph_snapshot` | R | **V3.1 cognitive summary** `.contora/graph/snapshot.json` |
| `get_project_impact` | R | **Deprecated** — reads `handoff.impact_summary` |
| `get_project_intent` | R | **Deprecated** — reads `handoff.current_focus` |

### Recommended workflows

**MCP only (no IDE):**

1. Configure MCP with `CONTORIUM_WORKSPACE`  
2. Start Agent — first call bootstraps `.contora/`  
3. Use `get_project_handoff` or `get_project_graph_snapshot` / `get_project_snapshot` / `get_workspace_context`  

**Extension + MCP (best precision):**

1. Open project in IDE; set **Current focus**  
2. Enable MCP in Agent; reads same `.contora/`  
3. Use `store_memory` for cross-session decisions  

**CLI only:**

```bash
contorium init . && contorium export .
```

### Environment variables

| Variable | Purpose |
|----------|---------|
| `CONTORIUM_WORKSPACE` | Explicit workspace root (preferred) |
| `CODEX_PROJECT_DIR` | Injected by Codex |
| `CLAUDE_PROJECT_DIR` | Injected by Claude Code |
| `MCP_WORKSPACE_ROOT` | Some hosts |

If unset: walk up from MCP process `cwd` to find `.contora/state.json`.

### vs one-click copy

| Method | Use case |
|--------|----------|
| **Copy AI-ready context** (extension) | Paste V3.1 canonical Markdown (incl. COGNITIVE SNAPSHOT) |
| **get_project_graph_snapshot** (MCP) | Compact cognitive summary (preferred over full graph) |
| **get_project_handoff** (MCP) | Execution handoff |
| **get_project_snapshot** (MCP) | L4 project snapshot |
| **get_state_conflicts** (MCP) | When audit conflicts are needed |

Copy export omits full conflict blocks and Intent graph; sidebar/MCP can show those separately.

---

## Uninstall / disable

### Cursor

Settings → MCP → disable or remove `contorium`, or delete the `mcp.json` entry.

### Claude Code

```bash
claude mcp remove contorium
```

If installed via `--plugin-dir`, stop loading that plugin directory.

### Codex

```bash
codex mcp remove contorium
```

### Gemini CLI

Remove `contorium` from `mcpServers` in settings.json; restart CLI.

### Clear MCP memory (optional)

**PowerShell (project root):**

```powershell
Remove-Item -Recurse -Force .contora\mcp -ErrorAction SilentlyContinue
```

**macOS / Linux:** `rm -rf .contora/mcp`

Does not affect `state.json` or other State Engine files.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `found: false` / no state.json | Set `CONTORIUM_WORKSPACE`; MCP bootstraps on start; or `contorium init .` |
| MCP fails to start | Run `npm run compile`; Node 18+; use absolute paths |
| Stale state | IDE: Save session state; MCP: wait 5s or change git/events; CLI: `contorium sync .` |
| Agent shows Canceled | Often Agent init cancel, not MCP crash; test with Inspector |
| Wrong `workspaceRoot` | Set `CONTORIUM_WORKSPACE` to project root absolute path |

---

## Build notes (maintainers)

```bash
npm run build:mcp
# or
npm run compile
```

Entry: `packages/mcp/dist/server.js`  
Launcher: `bin/contorium-mcp-launch.cjs`  
CLI (inside `packages/mcp` after install): `contorium-mcp`

---

## Related docs

- [README](../README.md)
- [Install overview](./INSTALL.md)
- [IDE Extension](./IDE_EXTENSION.md)
- [CLI](./CLI.md)
- [Architecture V3.1](./ARCHITECTURE_V3.md)
- [Engineering Closure](./ENGINEERING_CLOSURE.md)
- [State Engine](./STATE_ENGINE.md)
