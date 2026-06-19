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

**V4 Governance Engine** — single decision pipeline shared with IDE and CLI:

| Step | MCP Tool | IDE | CLI |
|------|----------|-----|-----|
| Bootstrap | `ensure_control_ready` | Startup ensure | `contorium control ready` |
| Context | `get_control_context` | View Rules | `contorium control governance` |
| Scope | `resolve_scope_context` | Open files + Git | Built into cycle |
| Review | — | Review Change | `contorium governance review --target <file>` |
| **Decision** | `run_governance_cycle` | Review Change (cycle) | `contorium governance cycle` |
| Inject | `generate_inject_payload` | Smart/Diff Inject | Dashboard Enter |
| Export | `export_governance_context` | Copy AI context | `[c]` · `contorium export` |

**Semantic separation:** `governance review` writes `review.json` only; `run_governance_cycle` writes the full artifact set under `.contora/governance/`.

Auxiliary tools: `update_project_intent`, `analyze_project`, `get_cognitive_state`, `get_change_log`.

See [docs/MCP.md](../docs/MCP.md) · [docs/INSTALL.md](../docs/INSTALL.md) · [docs/ARCHITECTURE_V3.md](../docs/ARCHITECTURE_V3.md).

---

## What it does

Contorium keeps a continuously updated understanding of your project and exposes it to AI tools through MCP:

- **Project handoff** — goal, focus, recent changes, impact graph (CHP v1)
- **Cross-tool continuity** — same `.contora/` memory across sessions and AI hosts
- **Semi-auto injection** — on a new chat, asks whether to inject runtime context (Y/n)
- **Runtime dashboard** — passive status line in the terminal (starts automatically)
- **Governance V4** — review / cycle / scope / decision / trace pipeline
- **Cognitive mode (A/B)** — optional skill suggestion overlay (display-only)

Everything is stored locally under `.contora/` in your project:

```text
.contora/
├── state.json / handoff.json
├── change.json / graph.json / timeline.json
├── graph/                    # knowledge, snapshot, hotspots
├── governance/               # review, decision, scope, trace, cycle
└── mcp/                      # store_memory (optional)
```

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

### Handoff and understanding (recommended)

| Tool | Purpose |
|------|---------|
| `get_project_handoff` | CHP v1 unified AI memory (`compact` / `markdown` / `json`) |
| `get_handoff_injection_status` | Semi-auto new-chat prompt state |
| `confirm_handoff_injection` | User confirmed (Y) — writes context file |
| `skip_handoff_injection` | User declined (N) for this chat |
| `get_recent_changes` | File and symbol updates |
| `get_understanding_graph` | Call chains + impact |
| `get_runtime_state` | Bootstrap / dashboard / session (read-only) |
| `get_workspace_context` | Read `state.json` snapshot |
| `get_project_graph_snapshot` | Compact cognitive summary |
| `get_project_knowledge_graph` | Full knowledge graph |

### Governance V4

| Tool | Purpose | CLI equivalent |
|------|---------|----------------|
| `ensure_control_ready` | Bootstrap governance + sync | `contorium control ready` |
| `get_control_context` | Read governance rules | `contorium control governance` |
| `resolve_scope_context` | Resolve scope from files + git | Built into cycle |
| `run_governance_cycle` | Full decision cycle | `contorium governance cycle` |
| `generate_inject_payload` | Build inject text for AI chat | Smart/Diff Inject (IDE) |
| `export_governance_context` | Export governance appendix | `[c]` · `governance export` |
| `update_project_intent` | Update project direction | `contorium control intent` |
| `analyze_project` | Analyze project | `contorium control analyze` |
| `get_cognitive_state` | Read cognitive projection | — |
| `get_change_log` | Structured change log | — |

### Cognitive mode (A/B)

| Tool | Purpose |
|------|---------|
| `get_cognitive_mode` | Read current mode (A = default, B = overlay) |
| `set_cognitive_mode` | Switch cognitive mode |
| `get_cognitive_insights` | Cognitive insights for workspace |
| `get_skill_suggestions` | Skill suggestions (mode B; display-only) |
| `get_model_preset` | Recommended model preset |

### Memory

| Tool | Purpose |
|------|---------|
| `store_memory` | Persist note/decision/architecture under `.contora/mcp/` |
| `search_memory` | Search memory by keyword |
| `get_memory` | Get memory entry by exact key |

### `get_project_handoff` parameters

| Param | Values | Default |
|-------|--------|---------|
| `format` | `compact`, `markdown`, `json` | compact |
| `filter` | symbol substring | none |
| `workspaceRoot` | override path | auto-detect |

Legacy tools (`get_project_change`, `get_project_graph`, `get_project_impact`, `get_project_intent`, …) remain available for backward compatibility.

### Unified export

IDE **Copy AI-ready context**, CLI dashboard **c**, `contorium export`, and `export_governance_context` all append a `GOVERNANCE:` block (`## DECISION` / `## SCOPE` / `## TRACE`) when `.contora/governance/` artifacts exist. Implementation lives in `@contora/state-core` (`buildGovernanceExportAppendixFull`).

---

## Semi-auto context injection

When runtime is active and the host opens a **new AI chat**:

1. MCP sets handoff injection to **pending**.
2. The agent asks: inject current project state? **(Y/n)**
3. **Y / Enter** → runtime context written to `.contora/mcp.auto-context.md`
4. **N** → start with a clean conversation

This happens automatically — no CLI command required.

---

## CLI mirror (optional)

MCP works standalone — no CLI required. When developing from source, the CLI adapter shares the same engine:

```bash
npm install && npm run compile    # repo root
npx contorium init .
npx contorium handoff
npx contorium governance cycle .
npx contorium export .
```

See [docs/CLI.md](../docs/CLI.md).

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
| Install (three adapters) | [docs/INSTALL.md](../docs/INSTALL.md) |
| Full MCP guide | [docs/MCP.md](../docs/MCP.md) |
| CLI guide | [docs/CLI.md](../docs/CLI.md) |
| Architecture | [docs/ARCHITECTURE_V3.md](../docs/ARCHITECTURE_V3.md) |
| Issues | https://github.com/ContoriumLabs/contorium/issues |

---

## License

MIT — see [LICENSE](https://github.com/ContoriumLabs/contorium/blob/main/LICENSE).
