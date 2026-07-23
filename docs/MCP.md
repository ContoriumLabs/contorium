# Contorium MCP Server (`@contorium/mcp`)

stdio MCP server — **PIL Runtime** for Claude Code, Cursor Agent, OpenAI Codex, Gemini CLI, and other MCP hosts.

- [Project Overview](./OVERVIEW.md) · [PIL Runtime Guide](./PIL_RUNTIME.md) · [Package README](../packages/mcp/README.md) · [Dashboard](./DASHBOARD.md) · [AI Layer](./AI_LAYER.md) · [CLI](./CLI.md) · [Install](./INSTALL.md)

---

## PIL Runtime Contract (v3.0)

| Group | Tools |
|-------|-------|
| **Inspect** | `inspect_state`, `inspect_intent`, `inspect_decision`, `inspect_timeline`, `inspect_graph`, `inspect_confidence`, `inspect_impact`, `inspect_evolution`, `inspect_provenance`, `inspect_health`, `inspect_why` |
| **Transfer** | `transfer_project` (`mode`: context \| intelligence \| story \| essence \| handoff); legacy: `transfer_context` / `transfer_intelligence` / `transfer_handoff` |
| **Capture** | `capture_focus`, `capture_note`, `capture_decision` |

CLI mirror: `contorium inspect …` · `contorium transfer …` · `contorium capture …`

---

## CIL tools (questions and narratives)

Natural-language and narrative queries route through **Cognitive Kernel**:

```text
ask_project · get_next_actions · get_cognitive_health · get_knowledge_health · get_review_queue
set_decision_lifecycle_meta · get_entity_knowledge
get_project_essence · get_handoff_replay · get_snapshot · get_decision_graph
get_project_history · transfer_story · transfer_project · get_suggested_questions
```

**Decision validity (Lifecycle v3):** `get_knowledge_health` and `get_review_queue` expose trust scores and invalidation triggers. `ask_project` attaches a validity overlay on decision answers. `set_decision_lifecycle_meta` records owner and verification (owner changes feed `OWNER_CHANGE` signals).

CLI mirror: `contorium ask` · `contorium lifecycle` · `contorium review` · `contorium health`

See [CIL.md](./CIL.md) · [LIFECYCLE.md](./LIFECYCLE.md) · [SURFACES.md](./SURFACES.md).

---

## AI Layer tools (optional — default off)

Explanation-layer LLM status and connectivity. Fact/PIL tools do not require LLM.

| Tool | Purpose |
|------|---------|
| `get_ai_status` | Enabled modules, provider, router mode (no secrets) |
| `test_ai_connection` | Test using `.contora/config/llm.json` + per-provider keys or env |

Configure via `contorium ai setup`, CLI dashboard **View E (LLM Config)**, or IDE `contora.cilAiEnabled`. Keys: `.contora/config/.llm-keys.json` (per provider).

See [AI_LAYER.md](./AI_LAYER.md).

---

## Quick reference

| Phase | Action |
|-------|--------|
| **Build (from source)** | Repo root: `npm install && npm run compile` |
| **Verify (debug only)** | `npx contorium-mcp --workspace /path/to/project` → expect `ready on stdio`, then Ctrl+C |
| **Published (npm)** | `npm install -g @contorium/mcp` · `contorium-mcp bootstrap --workspace .` |
| **Daily use** | Open Codex / Claude / Cursor — host starts MCP automatically |
| **Primary transfer** | `transfer_project` (`mode`: context \| intelligence \| story \| essence \| handoff) |
| **Primary inspect** | `inspect_state` · `inspect_intent` · `inspect_decision` · `inspect_why` · `inspect_health` |
| **Capture** | `capture_focus` · `capture_note` · `capture_decision` |
| **CIL Ask** | `ask_project` · `get_suggested_questions` |
| **Lifecycle** | `get_knowledge_health` · `get_review_queue` · `set_decision_lifecycle_meta` |
| **AI Layer** | `get_ai_status` · `test_ai_connection` |
| **New chat** | `get_handoff_injection_status` → `confirm_handoff_injection` / `skip_handoff_injection` |
| **Governance** | `inspect_cognition_ready` → `derive_decision_provenance` → `synthesize_context_payload` (**SLOW** — see [MCP_TOOL_CALLABILITY.md](./MCP_TOOL_CALLABILITY.md)) |
| **Verify tools** | `npm run test:mcp-tools:prefer` · full: `npm run test:mcp-tools` · report: [MCP_TOOL_CALLABILITY.md](./MCP_TOOL_CALLABILITY.md) |
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

## Extended tool reference (legacy + V3.1)

> **Prefer PIL v3.0 tools** in the [PIL Runtime Contract](#pil-runtime-contract-v30) section above: `inspect_*`, `transfer_*`, `capture_*`.  
> The tables below document **legacy and extended tools** still available for backward compatibility.

## Standard MCP v1 tools (legacy names)

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

### Project Intelligence (read-only vNext)

| Tool | Purpose |
|------|---------|
| `get_project_identity` | Cross-tool cognitive identity |
| `get_project_intent_graph` | vNext intent graph |
| `get_project_decision` | Decision provenance |
| `get_project_why` | Why layer |
| `get_project_evolution_timeline` | **TIMELINE** — structured evolution map |
| `get_impact_graph` | **IMPACT** — propagation + blast radius |
| `get_confidence_index` | **CONFIDENCE** — trustworthiness of records |
| `get_provenance_chain` | **PROVENANCE** — WHY → DECISION → INTENT → TIMELINE |
| `get_evolution_graph` | **EVOLUTION** — structured transformation chains |
| `get_project_intelligence_health` | **HEALTH** — weighted `health_score`, `knowledge_coverage` |
| `get_decision_log` | **DECISION log** — append-only decision records |
| `get_stability_index` | [Legacy] same as `get_confidence_index` |

See [PIL_RUNTIME.md](./PIL_RUNTIME.md) · [MCP tool callability](./MCP_TOOL_CALLABILITY.md).

`get_project_change`, `get_project_graph`, `get_project_knowledge_graph`, `get_project_graph_snapshot`, `get_workspace_context`, `get_project_snapshot`, `get_project_state`, `get_project_intelligence`, `get_intent_graph`, `get_active_intents`, `get_state_conflicts`, `store_memory`, `search_memory`, `get_memory`, and others remain available for backward compatibility.

---

## Decision Provenance tools (advanced / slow)

Single decision pipeline shared with IDE and CLI. Artifacts persist under `.contora/governance/`.  
These tools can take **1–3 minutes** on large workspaces — prefer `ask_project` / `inspect_*` / `get_knowledge_health` for ordinary questions. Call **at most one** derive cycle per turn (aliases share the same handler). See [MCP_TOOL_CALLABILITY.md](./MCP_TOOL_CALLABILITY.md).

| Tool | Purpose | IDE equivalent | CLI equivalent |
|------|---------|----------------|----------------|
| **`inspect_cognition_ready`** | Verify Decision Provenance layer initialized | Startup ensure | `contorium cognition inspect ready` |
| **`get_decision_context`** | Read decision provenance rules and context | View Rules | `contorium cognition inspect governance` |
| **`resolve_scope_context`** | Resolve scope from open files + git | Review scope selector | Built into derive |
| **`derive_decision_provenance`** | Derive decision provenance chain | Review Change (cycle path) | `contorium decision derive` |
| **`synthesize_context_payload`** | Synthesize inject text for AI chat | Smart/Diff Inject | Dashboard Enter |
| **`export_decision_provenance`** | Export decision provenance appendix | Copy AI context appendix | `[c]` · `decision synthesize` |

**Semantic separation:**

- Review-only flows write **`review.json`**
- `derive_decision_provenance` writes **decision / scope / trace / cycle** (and optional trace-full)

### Legacy governance tool aliases

| Legacy | Preferred |
|--------|-----------|
| `ensure_control_ready` | `inspect_cognition_ready` |
| `get_control_context` | `get_decision_context` |
| `run_governance_cycle` · `build_decision_provenance` | `derive_decision_provenance` |
| `generate_inject_payload` | `synthesize_context_payload` |
| `export_governance_context` | `export_decision_provenance` |

### Governance auxiliary tools

| Tool | Purpose |
|------|---------|
| **`record_project_intent`** | Record project direction text |
| **`analyze_project`** | Analyze project structure and intent |
| **`get_cognitive_state`** | Read cognitive projection state |
| **`get_change_log`** | Read structured change log |

---

## Cognitive mode tools (A/B)

| Tool | Purpose |
|------|---------|
| **`get_cognitive_mode`** | Read current mode (A = default, B = overlay) |
| **`set_cognitive_mode`** | Switch cognitive mode |
| **`get_cognitive_insights`** | Read cognitive insights for workspace |
| **`get_skill_suggestions`** | Skill suggestions (mode B only; display-only links) |
| **`get_model_preset`** | Read recommended model preset |

Mode B overlay suggests skills from open sources (GitHub, npm, local registry). Display-only — nothing is auto-installed. Switch modes from the runtime dashboard (↑↓ select, Enter apply) or via MCP tools.

---

## Full tool catalog

### Handoff and understanding

| Tool | Purpose |
|------|---------|
| `get_project_handoff` | CHP v1 unified AI memory |
| `get_handoff_injection_status` | Semi-auto new-chat prompt state |
| `confirm_handoff_injection` | User confirmed (Y) — write context file |
| `skip_handoff_injection` | User declined (N) for this chat |
| `get_recent_changes` | File and symbol updates |
| `get_understanding_graph` | Call chains + impact |
| `get_runtime_state` | Bootstrap / dashboard / session (read-only) |
| `get_workspace_context` | Read `state.json` snapshot |
| `get_project_snapshot` | L4 PROJECT SNAPSHOT markdown |
| `get_project_change` | `change.json` |
| `get_project_graph` | Change neighborhood `graph.json` |
| `get_project_timeline` | `timeline.json` |
| `get_project_knowledge_graph` | Full knowledge graph |
| `get_project_graph_snapshot` | Compact cognitive summary |
| `get_project_intelligence` | Derived project understanding |
| `get_intent_graph` | Intent graph |
| `get_active_intents` | Active intents |
| `get_state_conflicts` | State conflict audit |

### Memory

| Tool | Purpose |
|------|---------|
| `store_memory` | Persist note/decision/architecture under `.contora/mcp/` |
| `search_memory` | Search memory by keyword |
| `get_memory` | Get memory entry by exact key |

### Decision Provenance (advanced + legacy aliases)

`inspect_cognition_ready` · `get_decision_context` · `resolve_scope_context` · `derive_decision_provenance` · `synthesize_context_payload` · `export_decision_provenance` · `record_project_intent` · `analyze_project` · `get_cognitive_state` · `get_change_log`

Legacy: `ensure_control_ready` · `get_control_context` · `run_governance_cycle` · `generate_inject_payload` · `export_governance_context` · `update_project_intent`

### Cognitive mode

`get_cognitive_mode` · `set_cognitive_mode` · `get_cognitive_insights` · `get_skill_suggestions` · `get_model_preset`

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
| **`export_governance_context`** (MCP) | Governance appendix only |
| **Copy AI-ready context** (IDE) | Full canonical Markdown + governance appendix to clipboard |
| **`contorium handoff --copy`** (CLI) | Copy To AI for next chat (unified export) |
| **`contorium export`** (CLI) | Full export with governance appendix |

---

## Uninstall / disable

| Host | Action |
|------|--------|
| Cursor | Settings → MCP → remove `contorium` |
| Claude Code | `claude mcp remove contorium` |
| Codex | `codex mcp remove contorium` |
| Gemini CLI | Remove from `mcpServers` in settings.json |
| Global npm | `npm uninstall -g @contorium/mcp` |

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
- [Runtime Dashboard](./DASHBOARD.md)
- [CLI](./CLI.md)
- [IDE Extension](./IDE_EXTENSION.md)
- [Knowledge Lifecycle](./LIFECYCLE.md)
- [MCP tool callability](./MCP_TOOL_CALLABILITY.md)
