# Contorium — Install, Use, and Uninstall (Three Adapters)

> Back to [README](../README.md) · [Documentation index](./README.md) · [PIL Runtime Guide](./PIL_RUNTIME.md) · [Project Intelligence Layer v1.1.3](./PROJECT_INTELLIGENCE_LAYER.md) · Per adapter: [IDE](./IDE_EXTENSION.md) · [MCP](./MCP.md) · [CLI](./CLI.md)

Contorium is an **AI Project Intelligence Layer (PIL)**. IDE, MCP, and CLI are **peer PIL runtimes** sharing `@contora/state-core` and the project-local `.contora/` directory.

**Responsibility chain:** Capture → Structure → Preserve → Retrieve → Transfer

| Adapter | Typical user | Primary PIL loop |
|---------|--------------|------------------|
| **IDE** | VS Code / Cursor developers | Capture → Visualize → Transfer |
| **MCP** | Claude Code / Cursor Agent / Codex / Gemini | Retrieve → Inspect → Transfer |
| **CLI** | Terminal / CI / headless | Inspect → Audit → Transfer |

**Public API unchanged:** `state.json` fields remain backward compatible; MCP tool names and extension command IDs are stable. v2.2+ adds optional `source` metadata.

---

## What Contorium does

Contorium is the **AI Project Intelligence Layer** for AI-assisted development. It maintains a continuously updated record of project intelligence and exposes it through IDE, MCP, CLI, and the Cognitive State dashboard.

| Capability | Description |
|------------|-------------|
| **PIL Core** | Capture → Structure → Preserve → Retrieve → Transfer |
| **Inspect / Transfer / Capture** | Aligned capability groups across IDE, MCP, CLI (v3.0) |
| **Persistent project memory** | Task, focus, graphs, decisions survive sessions and tool switches |
| **Transfer Context / Intelligence / Handoff** | Tiered exports for AI continuity |
| **Semi-auto injection** | New AI chats prompt to inject runtime handoff (user confirm) |
| **Cognitive State dashboard** | Full-screen terminal UI — core, dimensions, streams |
| **Governance Engine (V4)** | Change review, scope, decision, trace pipeline |
| **Cross-tool continuity** | Claude Code, Codex, Cursor, Gemini CLI, VS Code share `.contora/` |

---

## Repository structure

```text
contorium/                         # Monorepo root (also VS Code/Cursor extension host)
├── src/                           # IDE extension source
│   ├── extension.ts               # Extension entry, command registration
│   ├── ai/                        # BYOK, governance inject, export
│   ├── cognition/                 # Sidebar Cortex / Graph panels
│   └── dashboard/                 # IDE-side Runtime Dashboard
├── packages/
│   ├── state-core/                # ★ PIL Core (shared by all runtimes)
│   │   ├── src/pil/               # capture · structure · preserve · retrieve · transfer
│   │   ├── understanding/         # Change detection, graphs, handoff builder
│   │   ├── governance/            # V4 artifacts, unified export
│   │   └── state-builder/         # L4 scan snapshot
│   ├── cli/                       # CLI PIL runtime + dashboard worker
│   │   ├── src/pil/               # inspect · transfer · capture commands
│   │   └── src/dashboard/         # Cognitive State terminal UI
│   ├── mcp/                       # MCP PIL runtime
│   │   ├── src/pilRuntime.ts      # inspect_* · transfer_* · capture_*
│   │   └── src/governanceV4.ts    # Governance V4 tools
│   └── runtime/                   # Runtime abstraction (embedded in IDE)
├── docs/                          # Install, architecture, dashboard guides
└── package.json                   # Extension manifest + top-level build scripts
```

---

## Architecture (three adapters)

Three adapters are **independent processes** that collaborate through **`@contora/state-core` + `.contora/`**:

```text
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  IDE Extension  │   │  CLI + Dashboard│   │   MCP Server    │
│     (src/)      │   │ (packages/cli)  │   │ (packages/mcp)  │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               ▼
                  ┌────────────────────────┐
                  │  @contora/state-core   │
                  │  sync · understanding  │
                  │  governance · handoff  │
                  └───────────┬────────────┘
                              ▼
                    .contora/ (shared artifacts)
```

**Understanding pipeline (V3.1):**

```text
IDE events / Git scan
  → change.json → graph.json → handoff.json → timeline.json
  → graph/knowledge.json → graph/snapshot.json
  → IDE sidebar / MCP tools / CLI export / Dashboard [c] copy
```

**Decision Provenance pipeline** (see [Language Spec](./CONTORIUM_LANGUAGE_SPEC.md)):

| Step | MCP tool (preferred) | IDE | CLI (preferred) |
|------|----------------------|-----|-----------------|
| Inspect ready | `inspect_cognition_ready` | Startup ensure | `contorium cognition inspect ready` |
| Context | `get_decision_context` | Sidebar + state | `contorium cognition inspect governance` |
| Scope | `resolve_scope_context` | Open files + Git | Built into derive |
| Derive | `derive_decision_provenance` | Review Change (cycle) | `contorium decision derive` |
| Understand | — | Review Change | `contorium understand --target <file>` |
| Synthesize | `synthesize_context_payload` | Smart/Diff Inject | Dashboard Enter · `decision synthesize` |
| Export | `export_decision_provenance` | Export AI context | `[c]` / `contorium export` |

**Semantic separation:**

- `understand` / `governance review` → writes **`review.json` only**
- `decision derive` → writes **decision / scope / trace / cycle** full artifact set

Legacy aliases (`ensure_control_ready`, `run_governance_cycle`, `contorium governance cycle`, `contorium control …`) remain supported.

See [ARCHITECTURE_V3.md](./ARCHITECTURE_V3.md) for the understanding layer design.

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
├── handoff.json             # CHP v1 AI handoff (single source for task/changes)
├── understanding_graph.json # call chains + impact (Runtime Understanding Graph)
├── change.json / graph.json / timeline.json
├── governance/              # V4 governance artifacts
│   ├── review.json          # Review results (review command only)
│   ├── decision.json        # Decision outcome (allow, risk, rule_count, …)
│   ├── scope.json           # Scope context (files, modules, dependencies)
│   ├── trace.json           # Summary trace (≤12 steps; dashboard/export read)
│   ├── trace-full.json      # Detailed reason_chain (≤64 entries)
│   └── cycle.json           # Full cycle record + matched_rules + metrics
├── runtime.bootstrap.json   # runtime_id (session-level, not in handoff)
├── mcp.auto-context.md        # written after user confirms semi-auto injection
├── mcp.handoff-injection.json # injection state per runtime_id
├── state-builder/           # L4 snapshot (scan or IDE cognition pipeline)
├── graph/                   # V3.1 cognitive graph (knowledge.json, snapshot.json, …)
├── config/                  # LLM settings (no secrets in llm.json)
│   ├── llm.json             # provider, model, modules, intent_router
│   └── .llm-keys.json       # per-provider API keys (gitignored)
├── cache/llm/               # optional LLM response cache
├── events/                  # IDE events (CLI/MCP read; IDE writes)
├── dashboard.*.json         # dashboard view/signals (not business state source)
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

### MCP server (`@contorium/mcp`)

```bash
git clone https://github.com/ContoriumLabs/contorium.git
cd contorium
npm install
npm run compile          # or npm run build:mcp
```

**Normal use:** configure once, then open Codex / Claude / Cursor — the host **spawns MCP automatically**. You do not run MCP in a terminal first.

**Local development config** (replace paths):

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

**When published to npm:**

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

| Host | Setup |
|------|-------|
| Cursor | `.cursor/mcp.json` or Settings → MCP → enable `contorium` |
| Claude Code | `claude mcp add --scope project contorium -- npx @contorium/mcp` |
| Codex | `codex mcp add contorium -- npx @contorium/mcp` |
| Gemini CLI | `~/.gemini/settings.json` → `mcpServers.contorium` |

See [MCP.md](./MCP.md) for step-by-step host guides.

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

1. `npm install -g @contorium/mcp` **or** `npm run compile` from source  
2. `contorium-mcp bootstrap --workspace /path/to/project` (optional)  
3. Configure MCP with `CONTORIUM_WORKSPACE` (see [MCP.md](./MCP.md))  
4. **Open Codex / Claude / Cursor** — host starts MCP and bootstraps `.contora/`  
5. **New chat:** injection prompt appears automatically — Agent asks Y/n, or use terminal **Enter/i** / IDE **[?]**
6. Agent calls **`inspect_state`** / **`transfer_context`** / **`transfer_handoff`** as needed (legacy: `get_project_handoff`, `get_understanding_graph`, …)

No manual MCP terminal. No IDE required; scan/merged mode is less precise without IDE events.

See also [Runtime Dashboard](./DASHBOARD.md) — full-screen **Cognitive State** TUI (auto-attached after bootstrap).

### CLI only

```bash
cd /path/to/your-project
npx contorium init .
npx contorium sync .
npx contorium snapshot .
npx contorium handoff .
npx contorium handoff --copy-to-ai
# debug only:
# npx contorium handoff --prompt-new-chat
# npx contorium handoff --show
npx contorium graph-snapshot .
npx contorium knowledge .
npx contorium export .
npx contorium governance review . --target path/to/file.ts
npx contorium governance cycle .
npx contorium governance export . --copy
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

## Command matrix (PIL v3.0 + legacy)

| Capability | IDE | MCP (PIL) | CLI (PIL) |
|------------|-----|-----------|-----------|
| Bootstrap `.contora/` | Open folder | Bootstrap on start | `contorium init` |
| Refresh git/paths | Auto scan | 5s + events/git watch | `contorium sync` |
| **Inspect state** | Sidebar | `inspect_state` | `contorium inspect state` |
| **Inspect health** | Cortex panels | `inspect_health` | `contorium inspect health` |
| **Transfer Context** | Sidebar button | `transfer_context` | `contorium transfer context [--copy]` |
| **Transfer Intelligence** | Sidebar button | `transfer_intelligence` | `contorium transfer intelligence [--copy]` |
| **Transfer Handoff** | Runtime inject | `transfer_handoff` | `contorium transfer handoff [--copy]` |
| **Capture focus / note** | Sidebar | `capture_focus` · `capture_note` | `contorium capture focus\|note` |
| **Semi-auto new chat inject** | Auto dialog + `[?]` status bar | `get_handoff_injection_status` → confirm | Dashboard **`i`** · debug: `handoff --prompt-new-chat` |
| **Runtime dashboard** | Auto attach on workspace open | Auto attach on MCP init | Auto attach after `bootstrap` |
| Legacy handoff / snapshot | Copy AI-ready context | `get_project_handoff` · `get_project_snapshot` | `contorium handoff` · `contorium snapshot` |
| Knowledge graph | AI Cortex sidebar | `inspect_graph` · `get_project_knowledge_graph` | `contorium inspect graph` · `contorium knowledge` |
| Change / graph / timeline | Cortex | `inspect_timeline` · legacy `get_project_*` | `contorium inspect timeline` · legacy commands |
| Status summary | Sidebar | tool JSON | `contorium status` |
| Write task/notes | Sidebar | — | — |
| Agent memory | — | `store_memory` | — |
| Canonical Markdown export | Copy AI-ready context | — | `contorium export` |
| **Change understanding** | Review Change | — | `contorium understand --target <file>` |
| **Decision derive** | Review Change (cycle path) | `derive_decision_provenance` | `contorium decision derive` |
| **Context synthesize** | Export appendix in copy | `synthesize_context_payload` | `[c]` · `contorium decision synthesize` |
| **Project intent / rules** | Edit Direction · View Rules | `record_project_intent` · `get_decision_context` | `contorium cognition inspect intent` · `cognition inspect governance` |
| **Cognitive view mode** | — | — | Dashboard **↑↓** — Live · Governance · Debug · History · **LLM Config** |
| **AI Layer status / test** | Developer → CIL AI Layer | `get_ai_status` · `test_ai_connection` | `contorium ai status` · `contorium ai test` |
| **LLM interactive setup** | — | — | Dashboard view **E** (provider → key → auto test) |

**Backward compatible:** extension command IDs, existing MCP tool names, `state.json` fields.

**V3.1 additions:** `.contora/graph/` artifacts, MCP extended tools (`get_recent_changes`, `get_understanding_graph`, `get_runtime_state`, handoff injection tools), CLI `knowledge` / `graph-snapshot`, semi-auto handoff injection, **Cognitive State** fullscreen dashboard.

**V4 governance additions:** `.contora/governance/*` artifacts, unified export appendix (`GOVERNANCE:` block), MCP governance V4 tools, CLI `governance` and `control` subcommands.

### npm install (`@contorium/mcp`)

```bash
npm install -g @contorium/mcp
contorium-mcp bootstrap --workspace /path/to/your-project
```

Single npm package — `@contora/state-core` is bundled inside. Maintainers: `npm run publish:npm` from repo root.

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
| Global npm | `npm uninstall -g @contorium/mcp` |

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

## Build scripts (maintainers)

From repo root:

| Script | Purpose |
|--------|---------|
| `npm run compile` | Full build (runtime + state-core + cli + mcp + extension) |
| `npm run build:cli` | CLI only |
| `npm run build:mcp` | MCP only |
| `npm run build:state-core` | state-core only |
| `npm run vsix` | Package VSIX for IDE extension |
| `npm run publish:npm` | Publish `@contorium/mcp` to npm |
| `npm test` | state-core tests |

After changing CLI or dashboard code: run `npm run build:cli` and **restart the dashboard worker** for changes to take effect.

---

## Related docs

- [README](../README.md)
- [Project Overview](./OVERVIEW.md)
- [IDE Extension](./IDE_EXTENSION.md)
- [MCP Server](./MCP.md)
- [CLI](./CLI.md)
- [Architecture V3.1](./ARCHITECTURE_V3.md)
- [Engineering Closure (frozen)](./ENGINEERING_CLOSURE.md)
- [Runtime Dashboard (CRBP)](./DASHBOARD.md)
- [State Engine](./STATE_ENGINE.md)
