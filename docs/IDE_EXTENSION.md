# Contorium IDE Extension (VS Code / Cursor)

Extension ID: `franklee-dev.contorium`  
Display name: **Contorium**  
Requires: VS Code / Cursor **1.85+**, **folder workspace** (single-file windows are limited)

The extension provides: sidebar UI, file/Git scanning, `.contora/state.json`, State Engine artifacts, and **one-click Copy AI-ready context**.  
Peer adapters: [MCP](./MCP.md), [CLI](./CLI.md). Overview: [INSTALL.md](./INSTALL.md).

---

## Command cheat sheet

| Phase | Action |
|-------|--------|
| **Install (VSIX)** | `npm run vsix` → **Install from VSIX** → **Developer: Reload Window** |
| **Install (dev)** | `npm install && npm run compile` → **F5** → open project folder in new window |
| **Verify** | Activity bar **Contorium** → sidebar shows Current focus / Copy button |
| **Daily use** | **Copy AI-ready context**; auto Passive line + mini-graph; **Space** → Expanded in terminal |
| **Governance** | Review Change · View Rules · Edit Direction · Smart/Diff Inject |
| **New AI chat** | Auto inject prompt (notification + status bar `[?]`) — **no command** |
| **Settings** | `contora.autoAttachDashboard` (default `true`) — auto-start dashboard worker |
| **Uninstall** | Extensions → Contorium → Uninstall → Reload |
| **Clear data (optional)** | Project root: `Remove-Item -Recurse -Force .contora` (PowerShell) |

---

## Install

### Option A: VSIX (recommended)

1. Get `contorium-0.9.1.vsix` (or current version):
   - [GitHub Releases](https://github.com/ContoriumLabs/contorium/releases), or
   - Repo root: `npm run vsix` (Node.js 18+)
2. Open **VS Code** or **Cursor**
3. **Extensions** → `…` → **Install from VSIX…**
4. Select the `.vsix` file
5. **Developer: Reload Window**

### Option B: Run from source (development)

```bash
git clone https://github.com/ContoriumLabs/contorium.git
cd contorium
npm install
npm run compile
```

Open the repo in VS Code/Cursor → **F5** → open your project folder in the Extension Development Host window.

### Option C: Marketplace (if published)

Search **Contorium**, publisher **franklee-dev**, then Reload Window.

---

## Verify installation

1. **Contorium** icon appears in the activity bar  
2. **File → Open Folder** (not single file only)  
3. Sidebar shows:
   - Current focus input
   - **Copy AI-ready context** button
   - Workspace snapshot / Git sections  

If the sidebar stays blank, see [Troubleshooting](#troubleshooting).

---

## Usage

### Sidebar (main UI)

| Action | Description |
|--------|-------------|
| **Current focus** | L0 task anchor → `state.json`; not auto-inferred |
| **Context notes** | Local notes included in export |
| **Copy AI-ready context** | V3.1 canonical context to clipboard (legacy full export) |
| **Runtime dashboard (status bar)** | CHP compact line from `handoff.json` + optional `⤷` mini-graph — click to expand |
| **AI Cortex** | Collapsible: Knowledge Graph, Hotspots, Function graph, Impact, Reason trace |
| **Sync state to disk** | Persist `state.json` immediately |
| **Restore editors** | Reopen editors from saved state |
| **Project state** | L4 snapshot preview (full body via Copy) |
| **State conflicts** | Unresolved v2 audit conflicts (display only) |
| **Intent graph** | L5 weak inference preview — **not** in main copy |

### Command palette

`Ctrl+Shift+P` (macOS: `Cmd+Shift+P`), search **Contorium**:

| Command | Purpose |
|---------|---------|
| Copy AI-ready context (clipboard) | One-click export (includes governance appendix when available) |
| Smart inject (governance → AI) | Pre-review + inject governance context into chat |
| Diff mode inject (governance → AI) | Diff-scoped governance inject |
| Review Change | Run governance review on current scope |
| View Rules | Open governance rules panel |
| Edit Direction | Update project intent |
| Save session state now | Persist immediately |
| Restore editors from saved state | Restore editors |
| Configure API key… (BYOK) | Optional cloud model keys |
| Observe workspace (AI summary) | BYOK workspace summary |
| Learn workspace intent (AI) | BYOK intent learning |
| Tighten context preview (AI) | BYOK compress preview |
| Start fresh AI context session | Clear session events + derived cognition |
| Show Runtime Dashboard | Expand live Webview panel (`Ctrl+Shift+C`) |
| Hide Runtime Dashboard | Minimize dashboard (`Ctrl+Shift+M`) |

When runtime handoff is pending, the status bar shows **`[?] Inject runtime?`** — click to inject context for your next AI chat (semi-auto; appears automatically on new chat when runtime is active).

### Runtime dashboard (CRBP — automatic)

When `contora.autoAttachDashboard` is enabled (default):

1. Opening a folder → **bootstrap** runs automatically.
2. **Passive line** on status bar (from `handoff.json` + mini-graph).
3. **New AI chat** → auto notification: *Inject context?* + status bar **`[?]`** (no command).
4. **Expanded dashboard** → **Space** in Contorium terminal tab (not `--show`).
5. Terminal keys: **Space** toggle · **c** copy · **Enter/i** inject · **n** skip · **q** quit.

Optional: **Ctrl+Shift+C** opens IDE Webview panel (secondary view).

See [DASHBOARD.md](./DASHBOARD.md).

### Governance (V4)

The IDE participates in the unified governance pipeline shared with MCP and CLI:

| Action | Command / UI | Artifact |
|--------|--------------|----------|
| Review current change | **Review Change** | `governance/review.json` |
| View rules | **View Rules** | reads control-core store |
| Edit project direction | **Edit Direction** | updates project intent |
| Smart inject to chat | **Smart inject (governance → AI)** | reads review + generates inject payload |
| Diff-scoped inject | **Diff mode inject** | scoped to git diff |
| Export with governance | **Copy AI-ready context** | full export + `GOVERNANCE:` appendix |

IDE **Review Change** writes `review.json` only. A full **cycle** (decision / scope / trace / cycle artifacts) is triggered via MCP `run_governance_cycle` or CLI `contorium governance cycle`.

See [INSTALL.md](./INSTALL.md#architecture-three-adapters) for the three-adapter governance matrix.

### Copy AI-ready context structure (V3.1 canonical)

Same as `contorium export` / `formatCanonicalAiMarkdown` (sections appear when data exists):

```text
# TASK ANCHOR
# PROJECT SNAPSHOT          (L4 pure project state)
# WORKING CONTEXT           (active files + recent Git)
# COGNITIVE SNAPSHOT        (graph/snapshot.json)
# CHANGE SET                (handoff modified symbols)
# IMPACT SET                (affected functions)
# AI HANDOFF (V3.1)         (goal / focus / risk / next)
# CODE EVOLUTION            (timeline recent commits)
# INSIGHTS                  (up to 4 weak hints, optional)
# NOTES / INSTRUCTION
---
GOVERNANCE:                  (when governance artifacts exist)
## DECISION
## SCOPE
## TRACE
```

JSON export (`contora.exportFormat: json`) includes `cognitiveSnapshot` when the knowledge graph exists.

**Not in main copy:** full Intent graph, State conflict details, full `knowledge.json` (use COGNITIVE SNAPSHOT instead).

### Local data layout

All data stays in the project; **not uploaded by default**:

```text
.contora/
├── state.json
├── events/<sessionId>.jsonl
├── intelligence/              # L5 semantic summary
├── intent-graph/              # L5 intent graph
├── state-builder/             # L4 project state + snapshot.md
├── state-engine/              # v2 conflict audit
├── handoff.json               # CHP v1 AI handoff
├── understanding_graph.json   # call chains + impact
├── change.json / graph.json / timeline.json
├── governance/                # V4 governance artifacts
│   ├── review.json            # Review results (IDE/CLI review)
│   ├── decision.json          # Decision outcome
│   ├── scope.json             # Scope context
│   ├── trace.json             # Summary trace
│   ├── trace-full.json        # Detailed reason_chain
│   └── cycle.json             # Full cycle record + matched_rules
├── runtime.bootstrap.json     # runtime_id (session-level)
├── mcp.auto-context.md        # after user confirms semi-auto injection
├── mcp.handoff-injection.json
├── dashboard.status.json      # view mode only (not state source)
├── dashboard.signal.json
├── dashboard.session.json
├── graph/                     # V3.1 cognitive graph
│   ├── knowledge.json
│   ├── snapshot.json
│   ├── hotspots.json
│   └── metadata.json
└── mcp/                       # MCP store_memory (if used)
```

Add `.contora/` to `.gitignore` (example provided in repo).

### Working with MCP / CLI (optional)

Adapters are **peers** — the extension is not required for MCP/CLI.

| Scenario | Notes |
|----------|-------|
| Extension only | Sidebar + copy is enough for daily use |
| Extension + MCP | Extension writes events; Agent reads via MCP |
| No extension | MCP or `contorium init` can bootstrap alone |

Same `.contora/` directory. See [INSTALL.md](./INSTALL.md).

---

## Uninstall

### Remove extension (keep project data)

1. **Extensions** → **Contorium** → **Uninstall**
2. **Developer: Reload Window**

Manual removal if corrupted:

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.cursor\extensions\franklee-dev.contorium-*" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:USERPROFILE\.vscode\extensions\franklee-dev.contorium-*" -ErrorAction SilentlyContinue
```

### Clear workspace Contorium data (optional)

Uninstalling the extension does **not** remove `.contora/`:

```powershell
Remove-Item -Recurse -Force .contora -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .context-recall -ErrorAction SilentlyContinue
```

### Clear BYOK keys (optional)

API keys use VS Code **SecretStorage**; may persist after uninstall depending on IDE behavior.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Sidebar loading/blank | Usually **`@contora/state-core` not installed correctly**: repo root `npm run compile` → Reload; compile before F5; reinstall VSIX after `npm run vsix`. Check **Output → Extension Host** for `state-core` |
| Cursor "installation corrupt" | Remove extension dirs manually, reinstall VSIX; reinstall Cursor if needed |
| Copy empty or stale | Edit/save files, wait ~7s or **Save session state now**, then copy |
| No `.contora` | Open folder; save once or **Sync state to disk** |
| VSIX install fails | Confirm `npm run vsix` succeeds (~350–400KB); avoid broken symlink packages |

**Logs:** `Ctrl+Shift+P` → **Developer: Show Logs** → **Extension Host**, filter `Contorium`.

---

## Related docs

- [README](../README.md)
- [Install / use / uninstall](./INSTALL.md)
- [Runtime Dashboard (CRBP)](./DASHBOARD.md)
- [MCP](./MCP.md)
- [CLI](./CLI.md)
- [State Engine](./STATE_ENGINE.md)
- [Architecture V3.1](./ARCHITECTURE_V3.md)
- [Engineering Closure](./ENGINEERING_CLOSURE.md)
- [Runtime package](./RUNTIME.md)
