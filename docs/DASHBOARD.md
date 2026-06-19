# Contorium Runtime Dashboard (CRBP)

Low-presence **Passive** status line + on-demand **Expanded** panels. Shared across **IDE**, **CLI**, and **MCP** via the same `.contora/` artifacts.

Overview: [INSTALL.md](./INSTALL.md) · [CLI](./CLI.md) · [MCP](./MCP.md)

---

## Design principles

| Principle | Implementation |
|-----------|----------------|
| **Zero commands (normal use)** | Bootstrap + Passive + inject prompt are automatic |
| **Single source of truth** | `handoff.json` + `state.json` — not `dashboard.status.json` |
| **Dashboard is a view** | Worker reads artifacts; does not own business state |
| **CHP v1 handoff** | Compact line: `task \| last \| agent` |

`runtime_id` lives in `.contora/runtime.bootstrap.json` only — not in handoff/CHP state.

---

## Normal use (no commands)

| Action | How |
|--------|-----|
| See runtime status | Passive line appears automatically (terminal + IDE status bar) |
| Expand full dashboard | **Space** in Contorium dashboard terminal |
| New AI chat inject | Auto `[?]` when runtime active → **Enter/i** · **n** · or IDE/Agent dialog |
| Copy handoff | **c** in terminal |

**Do not use** `contorium handoff --show` or `--prompt-new-chat` in daily workflow — those are debug-only.

## State machine

```text
Idle ──(runtime bootstrap)──► Passive ──(Space)──► Expanded
  ▲                              │                      │
  └──────── session end ─────────┴──── Space / q ──────┘
```

| State | Display |
|-------|---------|
| **Idle** | `[○] Contorium waiting for IDE session…` |
| **Passive** | `[●] [Contorium] task: … \| last: … \| agent: …` + optional **mini-graph** (`⤷ a→b→c`) |
| **Expanded** | Full panels + **fullscreen** (CLI alternate screen / IDE Webview) · **LIVE** refresh |

---

## Automatic triggers (no manual attach)

| Source | When | Action |
|--------|------|--------|
| **MCP initialize** | Codex / Claude / Cursor starts MCP | `bootstrap --source mcp` |
| **IDE workspace open** | Extension loads folder | `bootstrap --source ide` |
| **CLI init** | `contorium init` | `bootstrap --source cli` |
| **File / git change** | Save, sync, MCP reactive sync | `wake` → refresh Passive / Expanded (artifact watch) |

Users do **not** run `contorium attach` or `dashboard show` in normal workflows.

---

## Passive compact line (CHP v1)

Example (with mini-graph and pending injection):

```text
[●] [Contorium] task: fix MCP bootstrap | last: calculateRisk() | agent: mcp · ⤷ calculateRisk→updateGraph · [?] Enter/i inject · n skip
```

When no injection pending:

```text
[●] [Contorium] task: fix MCP bootstrap | last: calculateRisk() | agent: mcp · ⤷ calculateRisk→updateGraph · Space toggle · c Copy To AI · q quit
```

| Field | Source |
|-------|--------|
| `task` | `state.json` → `currentTask` or `handoff.current_focus` |
| `last` | Most recent symbol in `handoff.key_changes` |
| `agent` | `state.source.lastWriter` (`ide` / `mcp` / `cli`) |

**IDE status bar** reads `handoff.json` + `state.json` directly (survives if dashboard worker stops).  
**Expanded mode indicator** may still read `dashboard.status.json` for view mode only.

---

## Expanded panels (fullscreen)

| Platform | Behavior |
|----------|----------|
| **CLI** | Alternate-screen TTY · wide layout dual-column · **LIVE** badge on artifact change · call-chain tree |
| **IDE** | **Webview panel** beside editor — live refresh from `dashboard.status.json.frame` (~700ms) |

Expanded stays open until **Space** or **q** (CLI default `--timeout 0`).

| Section | Data source |
|---------|-------------|
| Function Updates | `handoff.json` / `change.json` |
| Agent Timeline | `.contora/events/*.jsonl` |
| Impact Graph | **`understanding_graph.json`** (preferred) or `graph.json` |
| Structure View | `graph.json` / cognitive snapshot |
| Project Status | handoff risk, git counts |
| **Copy To AI** | CHP commands + semi-auto injection hint + **GOVERNANCE:** appendix when artifacts exist |

---

## Keyboard (CLI dashboard terminal)

| Key | Action |
|-----|--------|
| **Enter** / **i** | Confirm semi-auto runtime injection (when pending) |
| **n** | Skip injection for this runtime session |
| **Space** | Toggle Passive ↔ Expanded |
| **c** | **Copy To AI** — unified export (handoff + governance appendix) to clipboard |
| **q** | Quit dashboard worker |
| **v** / **m** | Legacy expand / minimize (still supported) |

---

## IDE controls

| Action | How |
|--------|-----|
| Expand dashboard | Status bar click · **Ctrl+Shift+C** → **Webview panel** (live Expanded view) |
| Semi-auto inject | Status bar **`[?] Inject runtime?`** → **Inject** / **Skip** → clipboard |
| Minimize | **Ctrl+Shift+M** · close Webview panel |
| Disable auto-attach | Setting: `contora.autoAttachDashboard` = `false` |

Terminal tab name: **Contorium Dashboard** (background worker; optional).

---

## CLI commands (debug only)

| Command | Purpose |
|---------|---------|
| `contorium handoff --show` | Force expand (prefer **Space**) |
| `contorium handoff --prompt-new-chat` | Force inject prompt (normally automatic) |
| `contorium handoff --copy-to-ai` | Manual clipboard |
| `contorium attach . --auto` | Manual worker |

---

## Artifact files

```text
.contora/
├── handoff.json              # AI handoff (source of truth for task/changes)
├── state.json                # Task anchor, source.lastWriter
├── change.json               # Recent file/symbol changes
├── graph.json                # Change-neighborhood graph
├── understanding_graph.json  # Call chains + impact (Runtime Understanding Graph)
├── runtime.bootstrap.json    # runtime_id, bootstrap metadata (session-level)
├── mcp.auto-context.md       # written after user confirms semi-auto injection
├── mcp.handoff-injection.json # pending / injected / skipped per runtime_id
├── dashboard.status.json     # View mode only (not business state)
├── dashboard.signal.json     # expand / minimize / filter signals
└── dashboard.session.json    # IDE/MCP session marker
```

---

## Worker internals (maintainers)

- **Refresh:** `fs.watch` on `.contora/` (not tight polling on large repos)
- **Package:** `packages/cli/src/dashboard/`
- **Bootstrap:** `packages/cli/src/runtime/bootstrap.ts`

---

## Related docs

- [CLI handoff & dashboard commands](./CLI.md)
- [MCP bootstrap on initialize](./MCP.md)
- [IDE Extension status bar](./IDE_EXTENSION.md)
