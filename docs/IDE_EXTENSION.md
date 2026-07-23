# Contorium IDE Extension (VS Code / Cursor)

Extension ID: `franklee-dev.contorium`  
Display name: **Contorium — AI Project Intelligence Layer**  
Requires: VS Code / Cursor **1.85+**, **folder workspace**

The IDE is a **peer PIL Runtime** with MCP and CLI: sidebar UI, workspace scanning, `.contora/` artifacts, **Capture / Transfer**, governance UI, and runtime dashboard bootstrap.

- [PIL Runtime Guide](./PIL_RUNTIME.md) · [MCP](./MCP.md) · [CLI](./CLI.md) · [Install](./INSTALL.md)

---

## PIL workflow (IDE)

| Group | Sidebar / commands |
|-------|---------------------|
| **Capture** | Current focus · Capture note · Capture decision |
| **Transfer** | **Transfer Context** · **Transfer Intelligence** |
| **Inspect** | Project state · Intent graph · Knowledge graph · Governance panels |
| **Governance** | Review Change · View Rules · Edit Direction · Smart/Diff inject |

MCP equivalents: `capture_*` · `transfer_*` · `inspect_*`

---

## Command cheat sheet

| Phase | Action |
|-------|--------|
| **Install (VSIX)** | `npm run vsix` → **Install from VSIX** → **Developer: Reload Window** |
| **Install (dev)** | `npm install && npm run compile` → **F5** → open project folder |
| **Verify** | Activity bar **Contorium** → sidebar shows Current focus + Transfer buttons |
| **Capture** | Set **Current focus** · **Capture note** · **Capture decision** |
| **Transfer** | **Transfer Context** (default) · **Transfer Intelligence** (full) |
| **Dashboard** | Auto Cognitive State TUI in terminal after workspace open |
| **Governance** | Review Change · View Rules · Edit Direction |
| **New AI chat** | Semi-auto handoff inject prompt (user confirm) |
| **Settings** | `contora.autoAttachDashboard` (default `true`) |

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
| **Current focus** | PIL **Capture** → `state.json` `currentTask` |
| **Capture note / decision** | PIL **Capture** → `.contora/` decision / note records |
| **Transfer Context** | PIL **Transfer** (~300–800 tokens) → clipboard |
| **Transfer Intelligence** | PIL **Transfer** full export (~8000 tokens) |
| **Runtime dashboard** | Status bar CHP line + auto Cognitive State TUI |
| **Cortex** (collapsible) | **History · Decisions · Ask** (CIL v3) + knowledge graph, hotspots, impact |
| **Governance** | Review Change · View Rules · Edit Direction |
| **Sync state to disk** | Persist `state.json` immediately |
| **Restore editors** | Reopen editors from saved state |

### Command palette

`Ctrl+Shift+P` (macOS: `Cmd+Shift+P`), search **Contorium**:

| Command | Purpose |
|---------|---------|
| Transfer Context | PIL transfer — default cognitive snapshot to clipboard |
| Transfer Intelligence | PIL transfer — full intelligence export |
| Smart inject (governance → AI) | Pre-review + inject governance context |
| Diff mode inject (governance → AI) | Diff-scoped governance inject |
| Review Change | Run governance review on current scope |
| View Rules | Open governance rules panel |
| Edit Direction | Update project intent |
| Save session state now | Persist immediately |
| Restore editors from saved state | Restore editors |
| Ask Contorium… | CIL natural-language query (opens markdown preview) |
| Test CIL AI connection | Test explanation-layer LLM using workspace config |
| Project History… | CIL event feed overlay (last 7 days) |
| Decision Center… | CIL ADR / decision overlay |
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
4. **Expanded dashboard** — full-screen Cognitive State TUI in the Contorium terminal tab (automatic after bootstrap).
5. Terminal keys: **`c`** copy · **`i`** / Enter inject · **`↑↓`** view modes (including **LLM Config**) · **`←→`** LLM provider in view E · **`q`** quit.

Optional: **Ctrl+Shift+C** opens IDE Webview panel (secondary view).

### CIL AI Layer (optional)

Enable explanation-layer LLM (Why / Story / Essence / DNA / Ask polish):

| Setting | Purpose |
|---------|---------|
| `contora.cilAiEnabled` | Sync `enabled` to `.contora/config/llm.json` |
| `contora.aiProvider` | Provider (openai · anthropic · google/gemini · deepseek · off) |
| `contora.cilIntentRouter` | `rule` · `hybrid` · `llm` |
| Configure API key… | BYOK via SecretStorage (not written to repo) |

Sidebar **Developer → CIL AI Layer** shows status and test. CLI dashboard **View E** configures per-provider keys in `.llm-keys.json`.

See [AI_LAYER.md](./AI_LAYER.md) · [DASHBOARD.md](./DASHBOARD.md).

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

IDE **Review Change** writes `review.json` only. Full decision provenance (decision / scope / trace / cycle artifacts) is derived via MCP `derive_decision_provenance` or CLI `contorium decision derive`.

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
├── config/                    # LLM (no secrets in llm.json)
│   ├── llm.json
│   └── .llm-keys.json       # per-provider keys (gitignored)
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
- [Runtime Dashboard](./DASHBOARD.md)
- [MCP](./MCP.md)
- [CLI](./CLI.md)
- [Knowledge Lifecycle](./LIFECYCLE.md)
