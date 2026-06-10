# @contorium/mcp

**Contorium MCP Server** — persistent project memory and AI handoff for coding agents.

Works with **Claude Code · Cursor · Codex · Gemini CLI** and any MCP-compatible host.

🌐 https://www.contorium.dev/

---

## What's new in 0.9.5

**Recommended skills (A/B mode)** — choose how MCP handles skill suggestions:

| Option | Behavior |
|--------|----------|
| **A — Keep unchanged (default)** | Core runtime stays as today. No skill recommendations. |
| **B — Cognitive overlay** | Real-time skill suggestions while you work on the project — matched to your workspace from open sources (GitHub, npm, local registry, and similar). Display-only links; nothing is auto-installed. |

Switch modes from the runtime dashboard (**↑↓** select, **Enter** apply) or via MCP tools `get_cognitive_mode` / `set_cognitive_mode`.

---

## What it does

Contorium keeps a continuously updated understanding of your project and exposes it to AI tools through MCP:

- **Project handoff** — goal, focus, recent changes, impact graph
- **Cross-tool continuity** — same `.contora/` memory across sessions and AI hosts
- **Semi-auto injection** — on a new chat, asks whether to inject runtime context (Y/n)
- **Runtime dashboard** — passive status line in the terminal (starts automatically)

Everything is stored locally under `.contora/` in your project.

---

## Requirements

| Requirement | Notes |
|-------------|-------|
| Node.js | **18+** |
| Workspace | A real **project folder** (not a single file) |
| npm | Used by `npx`; no global install required for automatic setup |

---

## Setup — choose ONE method (MCP)

> **Important:** Pick **either** automatic setup **or** manual config — **not both**.
>
> Most users only need **Method 1 (automatic)**. Use Method 2 only when your host has no CLI register command, or auto setup fails.

| Method | Who it's for |
|--------|----------------|
| **Method 1 — Automatic (recommended)** | Codex, Claude Code, most users |
| **Method 2 — Manual config (fallback)** | Cursor file config, Gemini CLI, custom MCP hosts |

After either method, **daily use is fully automatic** — open your AI tool and the host spawns MCP. You do **not** run `contorium-mcp` in a terminal, and you do **not** need a separate bootstrap step.

---

## Method 1 — Automatic setup (recommended)

Run **one command** for your AI tool, then open it. No JSON files to edit.

`@contora/state-core` is bundled inside `@contorium/mcp` — no extra npm packages.

### Codex

```bash
codex mcp add contorium -- npx @contorium/mcp
```

Then open Codex in your project folder. Codex injects `CODEX_PROJECT_DIR` automatically.

### Claude Code

```bash
cd /path/to/your-project
claude mcp add --scope project contorium -- npx @contorium/mcp
```

Then open Claude Code in the same project. Claude injects `CLAUDE_PROJECT_DIR` automatically.

### Cursor

Cursor has no `mcp add` CLI. Use the **MCP settings UI** (still one-time, no file editing):

1. **Settings → MCP → Add MCP Server**
2. Name: `contorium`
3. Command: `npx`
4. Args: `@contorium/mcp`
5. Env (optional): `CONTORIUM_WORKSPACE` = your project root if auto-detect fails
6. Enable the server → **Developer: Reload Window**

### Optional — global install (faster cold start)

Not required when using `npx` above. Install only if you want a local binary:

```bash
npm install -g @contorium/mcp
```

Then replace `npx @contorium/mcp` with `contorium-mcp` in your host config or CLI register command.

### Verify automatic setup

Open your AI tool in the project. The host should connect MCP without you starting a terminal server.

Debug only (expect `ready on stdio`, then Ctrl+C):

```bash
npx @contorium/mcp --workspace /path/to/your-project
```

---

## Optional — IDE extension (VS Code / Cursor)

After MCP automatic setup above, you can optionally add the IDE extension. MCP works **standalone** — the extension is **not required**.

The extension adds sidebar UI, editor events, and **Copy To AI** in VS Code / Cursor. Both share the same `.contora/` project memory.

### Install from Marketplace (recommended)

1. Open **Extensions** in VS Code or Cursor
2. Search **`Contorium`**
3. Select **Contorium** by publisher **`franklee-dev`**
4. Click **Install** → **Reload Window**

Extension ID: `franklee-dev.contorium`

### Install from VSIX (alternative)

If Marketplace is unavailable:

1. Download `contorium-*.vsix` from [GitHub Releases](https://github.com/ContoriumLabs/contorium/releases)
2. **Extensions** → `…` → **Install from VSIX…**
3. Select the file → **Reload Window**

### Verify

- **Contorium** icon in the activity bar
- Open a **folder** (not a single file)
- Sidebar shows **Current focus** and **Copy AI-ready context**

### Uninstall IDE extension

**Extensions** → **Contorium** → **Uninstall** → **Reload Window**

Does not remove `.contora/` project data. Uninstalling the extension does not remove MCP.

---

## Method 2 — Manual config (fallback)

Use this **only if Method 1 is unavailable or failed**. Do **not** also run `mcp add` — pick one approach.

Replace paths with your own. On Windows, prefer forward slashes: `E:/projects/my-app`.

### Universal template (`.mcp.json` in project root)

```json
{
  "mcpServers": {
    "contorium": {
      "command": "npx",
      "args": ["@contorium/mcp"],
      "env": {
        "CONTORIUM_WORKSPACE": "/path/to/your-project"
      }
    }
  }
}
```

| Host | Where to put it |
|------|-----------------|
| Cursor | `.cursor/mcp.json` or **Settings → MCP** paste equivalent |
| Claude Code | `.mcp.json` in project root |
| Other MCP hosts | Host-specific MCP config file |

### Codex (`config.toml`)

Only if `codex mcp add` did not work:

```toml
[mcp_servers.contorium]
command = "npx"
args = ["@contorium/mcp"]

[mcp_servers.contorium.env]
CONTORIUM_WORKSPACE = "/path/to/your-project"
```

### Gemini CLI

Edit `~/.gemini/settings.json` or `<project>/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "contorium": {
      "command": "npx",
      "args": ["@contorium/mcp"],
      "env": {
        "CONTORIUM_WORKSPACE": "/path/to/your-project"
      }
    }
  }
}
```

Restart the Gemini CLI session after saving.

---

## Daily use (automatic — no extra steps)

Once setup is done (Method 1 or 2):

```text
Open Codex / Claude Code / Cursor Agent in your project
        ↓
Host spawns MCP automatically (npx @contorium/mcp)
        ↓
MCP bootstraps .contora/ + dashboard on its own
        ↓
New chat → optional Y/n inject prompt
        ↓
Agent calls get_project_handoff when needed
```

| Automatic (normal) | Manual (not needed) |
|--------------------|---------------------|
| Host starts MCP | Run `contorium-mcp` in a terminal first |
| MCP syncs `.contora/` on start | Run `bootstrap` before each session |
| Dashboard attaches on MCP start | Install or configure anything else |

---

## Workspace resolution

The server finds your project root in this order:

1. CLI flag: `--workspace /path/to/project`
2. Environment: `CONTORIUM_WORKSPACE` (also `CODEX_PROJECT_DIR`, `CLAUDE_PROJECT_DIR`, `CLAUDE_PROJECT_ROOT`, `MCP_WORKSPACE_ROOT`)
3. `.mcp.json` or `.cursor/mcp.json` → `mcpServers.contorium.env.CONTORIUM_WORKSPACE`
4. Walk up from cwd to find `.contora/state.json`

With **Method 1**, Codex and Claude usually need **no** `CONTORIUM_WORKSPACE` — the host injects the project directory.

---

## Commands (debug / advanced only)

| Command | When to use |
|---------|-------------|
| `contorium-mcp` | Your AI host runs this — not for daily manual use |
| `contorium-mcp bootstrap [--workspace PATH]` | Pre-sync `.contora/` without starting stdio (optional, before first session) |
| `npx @contorium/mcp --workspace PATH` | Debug MCP connectivity |

---

## MCP tools

### Recommended (MCP v1)

| Tool | Purpose |
|------|---------|
| `get_project_handoff` | CHP v1 unified AI memory (`compact` / `markdown` / `json`) |
| `get_handoff_injection_status` | Semi-auto new-chat prompt state |
| `confirm_handoff_injection` | User confirmed (Y) — writes context file |
| `skip_handoff_injection` | User declined (N) for this chat |
| `get_recent_changes` | File and symbol updates |
| `get_understanding_graph` | Call chains + impact |
| `get_runtime_state` | Bootstrap / dashboard / session (read-only) |

### `get_project_handoff` parameters

| Param | Values | Default |
|-------|--------|---------|
| `format` | `compact`, `markdown`, `json` | compact |
| `filter` | symbol substring | none |
| `workspaceRoot` | override path | auto-detect |

Legacy tools (`get_project_change`, `get_project_graph`, `get_workspace_context`, `store_memory`, …) remain available for backward compatibility.

---

## Semi-auto context injection

When runtime is active and the host opens a **new AI chat**:

1. MCP sets handoff injection to **pending**.
2. The agent asks: inject current project state? **(Y/n)**
3. **Y / Enter** → runtime context written to `.contora/mcp.auto-context.md`
4. **N** → start with a clean conversation

This happens automatically — no CLI command required.

---

## Environment variables

Usually **not needed** with Method 1 (Codex / Claude auto-inject project dir).

| Variable | Purpose |
|----------|---------|
| `CONTORIUM_WORKSPACE` | Explicit project root (Method 2 or multi-root setups) |
| `CODEX_PROJECT_DIR` | Injected by Codex |
| `CLAUDE_PROJECT_DIR` / `CLAUDE_PROJECT_ROOT` | Injected by Claude Code |
| `MCP_WORKSPACE_ROOT` | Some MCP hosts |

---

## Uninstall

### Remove MCP from your AI host

| Host | If you used Method 1 (automatic) | If you used Method 2 (manual) |
|------|----------------------------------|-------------------------------|
| Codex | `codex mcp remove contorium` | Remove `contorium` from `config.toml` |
| Claude Code | `claude mcp remove contorium` | Delete `.mcp.json` entry |
| Cursor | **Settings → MCP** → remove `contorium` | Delete `.cursor/mcp.json` entry |
| Gemini CLI | — | Remove `contorium` from `mcpServers` |

### Remove the npm package (only if globally installed)

```bash
npm uninstall -g @contorium/mcp
```

Using `npx` only? No uninstall needed — remove the host config above.

### Clear MCP-only project data (optional)

From your **project** root — does **not** remove shared `state.json` or `handoff.json`:

```bash
# macOS / Linux
rm -rf .contora/mcp

# Windows PowerShell
Remove-Item -Recurse -Force .contora\mcp -ErrorAction SilentlyContinue
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| MCP fails to start | Node 18+; retry Method 1; or switch to Method 2 with absolute `CONTORIUM_WORKSPACE` |
| `found: false` / empty handoff | Open AI tool **inside** your project folder; or set `CONTORIUM_WORKSPACE` (Method 2) |
| Wrong project shown | `CONTORIUM_WORKSPACE` must be your **application** folder |
| Config seems ignored | You may have **both** `mcp add` and `.mcp.json` — remove one (pick a single method) |
| Stale handoff / changes | Save files; MCP syncs automatically (~60s) |
| Package not found | Use `npx @contorium/mcp` in config (no global install required) |

---

## Links

| Resource | URL |
|----------|-----|
| Website | https://www.contorium.dev/ |
| GitHub | https://github.com/ContoriumLabs/contorium |
| Full MCP guide | https://github.com/ContoriumLabs/contorium/blob/main/docs/MCP.md |
| Issues | https://github.com/ContoriumLabs/contorium/issues |

---

## License

MIT — see [LICENSE](https://github.com/ContoriumLabs/contorium/blob/main/LICENSE).
