# Contorium MCP Server (`@contorium/mcp`)

stdio MCP server for **Claude Code, Cursor Agent, OpenAI Codex, Gemini CLI**, and other MCP-compatible hosts.

**You do not start MCP manually in normal use.** After one-time configuration, the AI host (Codex, Claude, Cursor, etc.) **spawns** `contorium-mcp` automatically when a session starts.

Overview: [INSTALL.md](./INSTALL.md) · [Dashboard](./DASHBOARD.md) · [CLI](./CLI.md) · [README](../README.md)

---

## Quick reference

| Phase | Action |
|-------|--------|
| **Build (from source)** | Repo root: `npm install && npm run compile` |
| **Verify (debug only)** | `npx contorium-mcp --workspace /path/to/project` → expect `ready on stdio`, then Ctrl+C |
| **Published (npm)** | `npm install -g @contorium/mcp` · `contorium-mcp bootstrap --workspace .` |
| **Daily use** | Open Codex / Claude / Cursor — host starts MCP automatically |
| **Primary AI tool** | `get_project_handoff` (CHP v1) |
| **New chat** | `get_handoff_injection_status` → `confirm_handoff_injection` |
| **Remove** | Host-specific: see [Uninstall](#uninstall--disable) |

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js | **18+** |
| Workspace | Real project **folder** (not a single file) |
| Build | `npm run compile` or `npm run build:mcp` before first use (source install) |
| Optional CLI | `@contora/cli` / `npx contorium` for dashboard bootstrap when not in monorepo |

---

## How MCP runs (important)

```text
You open Codex / Claude Code / Cursor Agent
        ↓
Host reads .mcp.json / MCP settings
        ↓
Host spawns: npx @contorium/mcp   (or node …/contorium-mcp.js)
        ↓
MCP connects over stdio
        ↓
On initialize: bootstrap runtime + semi-auto handoff prompt (user confirm)
        ↓
AI calls tools (get_project_handoff, …) when needed
```

| Do | Don't |
|----|-------|
| Configure MCP once per host | Run `npx contorium-mcp` in a terminal before opening Codex (unless debugging) |
| Set `CONTORIUM_WORKSPACE` to your **project** root | Point workspace at the contorium source repo unless you develop contorium itself |
| Restart Agent / reload MCP after config changes | Expect MCP to stay running after you close the AI client (host manages lifecycle) |

---

## Workspace resolution

The server resolves the project root in this order:

1. CLI flag: `--workspace /path/to/project`
2. Environment: `CONTORIUM_WORKSPACE` (also `CODEX_PROJECT_DIR`, `CLAUDE_PROJECT_DIR`, `CLAUDE_PROJECT_ROOT`, `MCP_WORKSPACE_ROOT`)
3. `.mcp.json` or `.cursor/mcp.json` → `mcpServers.contorium.env.CONTORIUM_WORKSPACE`
4. Walk up from cwd to find `.contora/state.json`

---

## Install from source

```bash
git clone https://github.com/ContoriumLabs/contorium.git
cd contorium
npm install
npm run compile
```

Entry points:

| Entry | Path |
|-------|------|
| **Standard bin (recommended)** | `packages/mcp/bin/contorium-mcp.js` |
| Monorepo launcher | `bin/contorium-mcp-launch.cjs` (delegates to standard bin) |
| Compiled server | `packages/mcp/dist/server.js` (direct / Inspector) |

Repo root also exposes: `npx contorium-mcp` after `npm link` or via root `package.json` bin.

Verify (debug):

```bash
npx contorium-mcp --workspace /path/to/your-project
# Expect:
# [contorium-mcp] workspace: …
# [contorium-mcp] ready on stdio
```

Press Ctrl+C to exit. In production, the AI host keeps this process alive.

**Bootstrap only** (sync `.contora` without stdio server):

```bash
npx contorium-mcp bootstrap --workspace /path/to/your-project
```

---

## Configuration templates

Replace paths with **your** absolute paths. On Windows, prefer forward slashes: `E:/projects/my-app`.

### Template A — local development (this repo)

```json
{
  "mcpServers": {
    "contorium": {
      "command": "node",
      "args": ["E:/path/to/contorium/packages/mcp/bin/contorium-mcp.js"],
      "env": {
        "CONTORIUM_WORKSPACE": "E:/path/to/your-project"
      }
    }
  }
}
```

### Template B — monorepo launcher (legacy-compatible)

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

### Template C — npm package (when published)

```json
{
  "mcpServers": {
    "contorium": {
      "command": "npx",
      "args": ["@contorium/mcp"],
      "env": {
        "CONTORIUM_WORKSPACE": "E:/path/to/your-project"
      }
    }
  }
}
```

---

## Host setup (step by step)

### Cursor

1. Build contorium (`npm run compile`).
2. Create **`.cursor/mcp.json`** in your **project** root (or use Cursor Settings → MCP):

```json
{
  "mcpServers": {
    "contorium": {
      "command": "node",
      "args": ["E:/path/to/contorium/packages/mcp/bin/contorium-mcp.js"],
      "env": {
        "CONTORIUM_WORKSPACE": "E:/path/to/your-project"
      }
    }
  }
}
```

3. **Settings → MCP** → enable `contorium`.
4. **Developer: Reload Window** or restart Agent.
5. Confirm MCP shows connected; ask Agent to call `get_project_handoff`.

**Uninstall:** Settings → MCP → remove `contorium`, or delete the config entry.

---

### Claude Code

**Option 1 — Plugin (recommended)**

```bash
cd /path/to/contorium
npm run build:mcp
claude --plugin-dir /path/to/contorium
```

Uses `.mcp.claude.json`: `CONTORIUM_WORKSPACE` defaults to `${CLAUDE_PROJECT_DIR}`.

**Option 2 — CLI register (project scope)**

```bash
cd /path/to/your-project
claude mcp add --scope project contorium -- node E:/path/to/contorium/bin/contorium-mcp-launch.cjs
```

**Option 3 — Project `.mcp.json`**

Same JSON as [Template A](#template-a--local-development-this-repo) in your project root.

**Uninstall:** `claude mcp remove contorium`

---

### OpenAI Codex

**Option 1 — CLI**

```bash
cd /path/to/contorium
npm run build:mcp
codex mcp add contorium -- node E:/path/to/contorium/bin/contorium-mcp-launch.cjs
```

Codex injects `CODEX_PROJECT_DIR`; often no extra env is needed when working inside the project directory.

**Option 2 — Codex plugin**

Use repo [`.mcp.json`](../.mcp.json) with [`.codex-plugin/plugin.json`](../.codex-plugin/plugin.json). See [commands/setup-mcp-codex.md](../commands/setup-mcp-codex.md).

**Option 3 — `config.toml` (some Codex versions)**

```toml
[mcp_servers.contorium]
command = "node"
args = ["E:/path/to/contorium/packages/mcp/bin/contorium-mcp.js"]

[mcp_servers.contorium.env]
CONTORIUM_WORKSPACE = "E:/path/to/your-project"
```

**Uninstall:** `codex mcp remove contorium`

---

### Gemini CLI

Edit global or project settings:

- Global: `~/.gemini/settings.json`
- Project: `<project>/.gemini/settings.json`

```json
{
  "mcpServers": {
    "contorium": {
      "command": "node",
      "args": ["/absolute/path/to/contorium/packages/mcp/bin/contorium-mcp.js"],
      "env": {
        "CONTORIUM_WORKSPACE": "/absolute/path/to/your-project"
      }
    }
  }
}
```

Restart the Gemini CLI session after saving.

**Uninstall:** Remove `contorium` from `mcpServers`.

---

### Other MCP hosts (Continue, Cline, custom TUIs, …)

Any host that supports **stdio MCP** can use [Template A](#template-a--local-development-this-repo). Paste the `mcpServers.contorium` block into that host's MCP configuration format.

---

## MCP Inspector (debug)

```bash
npx @modelcontextprotocol/inspector node packages/mcp/dist/server.js
```

Invoke tools in the browser; set `CONTORIUM_WORKSPACE` in the Inspector environment if needed.

---

## Standard MCP v1 tools (recommended)

| Tool | Purpose | Output |
|------|---------|--------|
| **`get_handoff_injection_status`** | Semi-auto new-chat prompt state | pending / prompt / compact |
| **`confirm_handoff_injection`** | User confirmed (Y) — write context file | `.contora/mcp.auto-context.md` |
| **`skip_handoff_injection`** | User declined (N) for this runtime | state only |
| **`get_project_handoff`** | CHP v1 unified AI memory | `compact` / `markdown` / `json` |
| **`get_recent_changes`** | File & symbol updates | `.contora/change.json` |
| **`get_understanding_graph`** | Call chains + impact | `.contora/understanding_graph.json` |
| **`get_runtime_state`** | Bootstrap / dashboard / session (read-only) | JSON |

### `get_project_handoff` parameters

| Param | Values | Default |
|-------|--------|---------|
| `format` | `compact`, `markdown`, `json` | compact + legacy `handoff` object when omitted |
| `filter` | symbol substring | none |
| `workspaceRoot` | override path | auto-detect |

### Legacy tools (still supported)

`get_project_change`, `get_project_graph`, `get_project_knowledge_graph`, `get_project_graph_snapshot`, `get_workspace_context`, `store_memory`, and others remain available for backward compatibility.

---

## Semi-Auto Context Injection (automatic — no CLI command)

When runtime is active and the host opens a **new AI chat** (new MCP stdio session):

1. MCP initialize calls `prepareHandoffInjection({ newChat: true })` → **pending** state.
2. Server **instructions** tell the Agent to call `get_handoff_injection_status` and ask the user Y/n.
3. User confirms via UI (no command):
   - **Terminal dashboard:** `[?]` on Passive line → **Enter/i** · **n**
   - **IDE:** auto notification + status bar **`[?] Inject runtime?`**
   - **Agent:** `confirm_handoff_injection` / `skip_handoff_injection`
4. On confirm → `.contora/mcp.auto-context.md` + clipboard (IDE).

**Debug only:** `contorium handoff --prompt-new-chat` (TTY fallback).

Each new chat re-prompts; skip/inject applies to the current chat only (`chat_session_id`).

---

## Runtime bootstrap (automatic)

When MCP starts, it schedules (via CLI adapter, detached):

- `contorium bootstrap --source mcp` — sync + Passive dashboard worker
- MCP light sync — 5s poll + watch on `.contora/events` and `.git/HEAD`
- Dashboard wake on file/git changes

See [DASHBOARD.md](./DASHBOARD.md). No manual `contorium attach` in normal use.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `CONTORIUM_WORKSPACE` | Explicit project root (**preferred**) |
| `CODEX_PROJECT_DIR` | Injected by Codex |
| `CLAUDE_PROJECT_DIR` / `CLAUDE_PROJECT_ROOT` | Injected by Claude Code |
| `MCP_WORKSPACE_ROOT` | Some hosts |

---

## vs IDE one-click copy

| Method | Use case |
|--------|----------|
| **`get_project_handoff`** (MCP) | Agent-native; use semi-auto injection for new chats |
| **`get_understanding_graph`** (MCP) | Call-chain + impact view |
| **Copy AI-ready context** (IDE) | Full canonical Markdown to clipboard |
| **`contorium handoff --copy`** (CLI) | Copy To AI for next chat |
| **`contorium export`** (CLI) | Legacy full export |

---

## Uninstall / disable

| Host | Action |
|------|--------|
| Cursor | Settings → MCP → remove `contorium` |
| Claude Code | `claude mcp remove contorium` |
| Codex | `codex mcp remove contorium` |
| Gemini CLI | Remove from `mcpServers` in settings.json |

Clear MCP-only memory (optional, project root):

```powershell
Remove-Item -Recurse -Force .contora\mcp -ErrorAction SilentlyContinue
```

Does not remove `state.json`, `handoff.json`, or other shared artifacts.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| MCP fails to start | `npm run compile`; Node 18+; use absolute paths in config |
| `found: false` / no handoff | Set `CONTORIUM_WORKSPACE`; run `npx contorium init .` in project |
| Wrong project | `CONTORIUM_WORKSPACE` must be the **application** root, not contorium repo |
| Stale state | Save files; wait for MCP sync; or `npx contorium sync .` |
| Agent shows Canceled | Often Agent init cancel, not MCP crash; test with Inspector |
| Dashboard not visible | Press **Space** in Contorium terminal tab, or enable IDE status bar — debug: `handoff --show` — see [DASHBOARD.md](./DASHBOARD.md) |
| Published npm 404 | Run `npm login`; publish with `npm run publish:npm`; or use local `node …/contorium-mcp.js` |

---

## Build notes (maintainers)

```bash
npm run build:mcp
# or
npm run compile
```

Package: `packages/mcp` · name `@contorium/mcp` · bin `contorium-mcp`  
Publish (maintainers, repo root): `npm run publish:npm` — bundles `@contora/state-core` inside the tarball (single npm package).

### `contorium-mcp` subcommands

| Command | Purpose |
|---------|---------|
| `contorium-mcp` | Start stdio MCP server (default — host spawns this) |
| `contorium-mcp bootstrap [--workspace PATH]` | Pre-sync `.contora` + schedule dashboard **without** starting stdio |

```bash
npm install -g @contorium/mcp
contorium-mcp bootstrap --workspace E:/your-project
```

---

## Related docs

- [Install overview](./INSTALL.md)
- [Runtime Dashboard (CRBP)](./DASHBOARD.md)
- [CLI](./CLI.md)
- [IDE Extension](./IDE_EXTENSION.md)
- [Architecture V3.1](./ARCHITECTURE_V3.md)
