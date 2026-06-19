# Contorium V3 Core — Architecture & Usage

**V3 Core** is the minimum defensible layer of Contorium: **Governance + Cognitive MVP + Lightweight Guard**. It sits on top of the existing **V3.1 Project Understanding** pipeline (`handoff`, `graph`, knowledge graph) without replacing it.

> Design reference: internal upgrade notes (`v3升级文档.md`, `v3.2补充.md`).  
> V3.1 cognitive compiler rules remain frozen in [ENGINEERING_CLOSURE.md](./ENGINEERING_CLOSURE.md).

---

## 1. System positioning

| Layer | Role |
|-------|------|
| **V3.1 Understanding** | AI context compiler — change detection, handoff, knowledge graph |
| **V3 Core Governance** | Project rules — what AI must not do |
| **V3 Core Cognitive** | Project brain projection — state, intent, graph, risk |
| **V3 Core Guard** | AI firewall — detect → warn → confirm → block |

**What V3 Core is not:**

- Not a full approval workflow or multi-role SaaS
- Not a public REST platform (internal API only for now)
- Not a replacement IDE or agent framework

**One-line definition:**

> Contorium V3 Core constrains AI behavior in software projects using local governance files and pre-action checks.

---

## 1.1 Engineering status: **Freeze + Validate**

**V3 Core module structure is frozen at `V3_CORE_FREEZE_VERSION` (`0.9.5`).**

| Phase | Action |
|-------|--------|
| **Now** | Stop adding modules — validate on real projects |
| **Next** | Observe Guard leaks, cognitive drift, truth gaps |
| **Later** | Optional adapter hard-hooks — not REST, not approval UI |

> Architecture is complete; runtime path must stay lean. Prefer **one request through the MVP flow** over new features.

---

## 1.2 Single source of truth (avoid dual-truth)

| System | Role | Writable by |
|--------|------|-------------|
| **V3.1** (`handoff.json`, `graph.json`, `graph/knowledge.json`) | **Raw execution context** — what changed, impact, next actions | Understanding pipeline + IDE events |
| **V3 Core cognitive/** (`state.json`, `intent.json`, …) | **Derived project cognition** — safe to regenerate | `syncCognitiveLayer()` only |
| **V3 Core cognitive/user-request.json** | **User overlay** — recent goal/constraints from chat | `update_project_intent` |
| **V3 Core governance/** | **User-owned rules** | User + one-time bootstrap |

**Rule:** Never treat `cognitive/intent.json` as independent truth. It is always projected from V3.1 handoff + optional `user-request.json`.

**Truth layer note:** `truth.json` is a **metadata registry + snippet detector** at this stage — not full runtime truth enforcement. Manual tagging is expected for V3 Core.

---

## 2. Monorepo structure

```text
contorium/
├── src/                          # VS Code / Cursor extension
├── packages/
│   ├── state-core/               # @contora/state-core — single source of truth
│   │   ├── understanding/        # V3.1 pipeline (handoff, graph, knowledge)
│   │   └── governance/           # V3 Core (governance, guard, cognitive)
│   ├── mcp/                      # @contorium/mcp — MCP stdio server + tools
│   ├── cli/                      # @contora/cli — terminal + dashboard worker
│   └── runtime/                  # @contora/runtime — RuntimeProvider stub
└── .contora/                     # Local project memory (all adapters share this)
```

**Adapter pattern:** IDE, MCP, and CLI are peer adapters. They read/write `.contora/` through `@contora/state-core` — no adapter owns the truth.

**Control Surface:** All three adapters route V3 Core operations through `control-core` (`createControlSurface`) — not directly to governance modules. MCP is an adapter, not the privileged entry.

```text
         state-core (truth + governance + cognitive)
                    │
              control-core API
                    │
      ┌─────────────┼─────────────┐
      │             │             │
    IDE          MCP           CLI
  (commands)    (tools)      (control *)
```

---

## 3. Architecture diagram

```text
┌──────────────────────────────────────────────────────────────┐
│  Adapters: IDE Extension · MCP Server · CLI / Dashboard      │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│  @contora/state-core                                         │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │ V3.1 Understanding  │  │ V3 Core                      │  │
│  │ change → graph →    │  │ governance/                  │  │
│  │ handoff → knowledge │  │ executionGuard · cognitive   │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│  .contora/  (local storage)                                  │
└──────────────────────────────────────────────────────────────┘
```

### Request lifecycle (V3 Core)

```text
User / AI request
        ↓
Cognitive Layer (optional: update_project_intent)
        ↓
Governance read (get_governance)
        ↓
Pre-action check (check_action)  ← Lightweight Guard
        ↓
allow | warn | confirm | block
        ↓
Runtime execution + audit log (validate_governance / change-log)
        ↓
Feedback: sync cognitive projection from V3.1 handoff
```

---

## 4. Storage layout (`.contora/`)

### V3.1 artifacts (unchanged)

| Path | Role |
|------|------|
| `state.json` | Workspace scan + task + git fields |
| `handoff.json` | **Sole AI execution entry** (goal, focus, impact, next actions) |
| `change.json` | Current change semantics |
| `graph.json` | Change-neighborhood structural graph |
| `timeline.json` | Recent commit evolution |
| `graph/knowledge.json` | Project cognitive graph (L2, frozen boundary) |
| `graph/snapshot.json` | Compact export / MCP snapshot |

See [ARCHITECTURE_V3.md](./ARCHITECTURE_V3.md) for the full V3.1 model.

### V3 Core artifacts (new)

| Path | Role | Writable by |
|------|------|-------------|
| `governance/constitution.json` | Principles, protected paths, forbidden actions | User + bootstrap seed |
| `governance/truth.json` | Mock paths, hardcoded registry, production flags | User + bootstrap seed |
| `governance/identity.json` | Project name, purpose, focus, non-goals | User + bootstrap seed |
| `cognitive/state.json` | Phase, progress, focus, active tasks | Derived + `update_project_intent` |
| `cognitive/intent.json` | Goal, constraints, success metrics | Derived + `update_project_intent` |
| `cognitive/graph.json` | Module-level graph projection | Derived + `update_project_intent` |
| `cognitive/risk.json` | Risk summary from handoff impact | Derived (regenerated) |
| `cognitive/user-request.json` | User goal overlay from chat | User via `update_project_intent` |
| `cognitive/inputs-*.jsonl` | User intent input audit | Append-only |
| `runtime/change-log.json` | Guard check history | Guard / validate_governance |
| `runtime/guard-session.json` | Last `check_action` timestamp | MCP / adapter hook |
| `runtime/execution_logs/*.jsonl` | Execution guard events | Append-only |

**Important:** `cognitive/` is a **derived cache**. Safe to regenerate from V3.1 + user input. `governance/` is **user-owned** — bootstrap seeds defaults once and never overwrites existing files.

---

## 5. Module reference (`packages/state-core/src/governance/`)

| Module | Responsibility |
|--------|----------------|
| `types.ts` | Data models: Constitution, TruthLayer, Identity, ExecutionGuardResult |
| `defaults.ts` | Bootstrap templates (constitution, truth, identity from `package.json`) |
| `store.ts` | Read/write `.contora/governance/`, `cognitive/`, `runtime/` |
| `init.ts` | `ensureGovernanceLayer()` — first-run seed |
| `governanceEngine.ts` | Rule validation: protected paths, forbidden actions, truth registry |
| `hardcodeDetector.ts` | Snippet-based hardcode / credential pattern detection |
| `executionGuard.ts` | **AI Firewall** — `preActionCheck()` → allow / warn / confirm / block |
| `cognitiveProjection.ts` | Project V3.1 handoff → `.contora/cognitive/` |
| `cognitiveLoop.ts` | User input → intent / state / graph update |
| `changeTracker.ts` | Guard results → change-log + execution_logs |
| `adapterHook.ts` | Optional adapter entry — `adapterPreWriteHook()`, guard session |
| `internalApi.ts` | In-process API: `analyzeProject`, `getProjectState`, `validateChange` |

### Guard behavior (V3.2 lightweight model)

| Action | Trigger | `allow` | User override |
|--------|---------|---------|-----------------|
| **allow** | No rule violation | `true` | — |
| **warn** | Low/medium risk, identity hint, confirmed override | `true` | Notify user |
| **confirm** | Protected path, truth registry, high-risk hardcode | `false` | Retry with `user_confirmed: true` |
| **block** | Forbidden action in constitution | `false` | Do not proceed |

Example Guard response:

```json
{
  "allow": false,
  "action": "confirm",
  "reason": "Path is protected by constitution: packages/state-core/src/understanding/knowledgeGraph/",
  "suggestion": "requires governance override — ask user, then retry with user_confirmed: true",
  "risk_level": "high",
  "detections": []
}
```

---

## 5.5 Control Surface (`control-core`)

**Path:** `packages/state-core/src/control-core/`

All adapters use the same closed-loop API:

```typescript
import { createControlSurface } from '@contora/state-core';

const control = createControlSurface(workspaceRoot, 'mcp'); // or 'ide' | 'cli'

await control.ensureReady();           // governance seed + sync
await control.getGovernance();         // constitution / truth / identity
await control.checkAction({ ... });    // pre-action guard
await control.updateIntent(text);      // user overlay → cognitive projection
await control.executeAction({ ... });  // check + audit + cognitive feedback
await control.analyze();               // full snapshot
```

### Per-adapter binding

| Adapter | Entry | Independent closed loop? |
|---------|-------|------------------------|
| **MCP** | MCP tools → `createControlSurface(root, 'mcp')` | ✔ Yes |
| **CLI** | `contorium control *` → `createControlSurface(root, 'cli')` | ✔ Yes |
| **IDE** | Commands + `src/control/controlBridge.ts` | ✔ Yes (no MCP required) |

### CLI commands

```bash
contorium control governance [path]
contorium control check [path] --target packages/mcp/src/server.ts
contorium control intent [path] "implement feature X"
contorium control analyze [path]
contorium control execute [path] --target src/core/foo.ts --strict
contorium control ready [path]
```

### IDE commands

| Command | Action |
|---------|--------|
| `Contorium: Show Governance` | `controlGovernance` |
| `Contorium: Check Active File` | `controlCheck` on active editor |
| `Contorium: Update Project Intent` | `controlIntent` input box |

---

## 6. MCP tools (via control-core)

Registered in `packages/mcp/src/governanceTools.ts`.

| Tool | Purpose |
|------|---------|
| `get_governance` | Read constitution, truth, identity |
| `check_action` | **Primary** pre-action Guard (use before file edits) |
| `validate_governance` | Guard + write audit to `change-log.json` |
| `update_project_intent` | Parse user request → update cognitive intent/state/graph |
| `get_cognitive_state` | Read cognitive projection |
| `analyze_project` | Internal API snapshot (governance + cognitive + handoff) |
| `get_project_state` | Bootstrap state + governance readiness |
| `get_change_log` | Recent guard checks |

### Recommended AI workflow

```text
1. get_governance
2. check_action { target_path, description, code_snippet? }
3. if action=confirm → ask user → retry with user_confirmed: true
4. if action=block → stop
5. optional: validate_governance for audit trail
```

MCP server instructions (`packages/mcp/src/server.ts`) enforce this flow for new chats and code edits.

### Guard enforcement model

| Mode | Behavior |
|------|----------|
| **Soft (default)** | AI must call `check_action` — protocol-based |
| **Session tracking** | `check_action` writes `runtime/guard-session.json` |
| **Reminder** | Set `CONTORIUM_GUARD_REMIND=1` — `get_project_handoff` includes `governance_reminder` when session stale |
| **Strict adapter hook** | `adapterPreWriteHook(..., { strict: true })` — blocks confirm/block at adapter boundary |

```typescript
import { adapterPreWriteHook } from '@contora/state-core';

const result = await adapterPreWriteHook(workspaceRoot, {
  type: 'file_write',
  target_path: 'src/core/engine.ts',
}, { strict: true, source: 'ide-hook' });

if (!result.allowed) {
  // stop write or prompt user
}
```

IDE / CLI integration of `adapterPreWriteHook` is **optional** and recommended — not a full approval system.

---

## 6.1 MVP runtime flow (one request end-to-end)

Use this to validate the closed loop on a real project:

```text
1. Open MCP in project folder
        → ensureGovernanceLayer() seeds governance/ if missing

2. User: "Add feature X in packages/api"
        → update_project_intent { user_input }
        → writes cognitive/user-request.json
        → syncCognitiveLayer() rebuilds cognitive/*.json

3. AI reads context
        → get_project_handoff        (V3.1 raw execution context)
        → get_governance             (rules)

4. Before editing src/core/foo.ts
        → check_action { target_path, description }
        → allow | warn | confirm | block

5. If confirm → ask user → retry with user_confirmed: true

6. Optional audit
        → validate_governance        (writes change-log)

7. After code saves
        → adapterSync refreshes handoff + cognitive projection
```

---

## 7. Internal API (not HTTP)

Programmatic access from any adapter:

```typescript
import {
  analyzeProject,
  getProjectState,
  preActionCheck,
  updateCognitiveFromInput,
  validateChange,
  ensureGovernanceLayer,
  syncCognitiveLayer,
} from '@contora/state-core';

// Bootstrap governance on first run
await ensureGovernanceLayer(workspaceRoot);

// Pre-action guard
const guard = await preActionCheck(workspaceRoot, {
  type: 'file_write',
  target_path: 'src/core/engine.ts',
  description: 'refactor core module',
  code_snippet: optionalCode,
  user_confirmed: false,
});

// Cognitive loop from user text
await updateCognitiveFromInput(workspaceRoot, 'implement auth middleware in packages/api');

// Full snapshot
const snapshot = await analyzeProject(workspaceRoot);
```

Public REST endpoints (`POST /api/validate`, etc.) are **deferred** per V3.2 priority.

---

## 8. Bootstrap & sync

Governance and cognitive projection hook into the shared sync path:

```text
syncWorkspaceState (adapterSync.ts)
  → ensureGovernanceLayer()        # seed governance/ if missing
  → merge state.json
  → rebuild V3.1 artifacts (when needed)
  → syncCognitiveLayer()           # always refresh cognitive projection
```

Triggered by:

- MCP startup (`ensureWorkspaceBootstrapped`)
- MCP light sync (60s poll + file watch)
- CLI bootstrap
- IDE events → adapter sync

---

## 9. Usage by surface

### MCP (Claude Code, Cursor, Codex, Gemini CLI)

1. One-time setup — see [MCP.md](./MCP.md) or `packages/mcp/README.md`
2. Open AI tool in project folder — MCP bootstraps `.contora/`
3. Before editing protected paths: `check_action`
4. For new goals: `update_project_intent`
5. For project context: `get_project_handoff` (V3.1) + `get_governance` (V3 Core)

### CLI / Dashboard

```bash
npx contorium attach              # passive / expanded dashboard
npx contorium-mcp mode-panel      # cognitive Mode A/B panel (fallback)
```

Dashboard shows runtime task, handoff, mini-graph. Guard is MCP-driven (no approval UI).

### IDE extension

- Sidebar: current focus, Copy AI-ready context
- Writes `.contora/events/` → triggers same sync pipeline
- Shares memory with MCP — no separate state

### Customizing governance per project

Edit after first bootstrap:

```text
.contora/governance/constitution.json   → protected_paths, forbidden_actions
.contora/governance/truth.json          → mock_data globs, hardcoded_values[]
.contora/governance/identity.json       → purpose, non_goals, current_focus
```

Default `protected_paths` includes Contorium monorepo paths — **adjust for your own repo**.

---

## 10. Testing

Build state-core, then run the V3 Core test suite:

```bash
npm run build:state-core
npm run test:v3-core
```

Or from the repo root after compile:

```bash
npm test
```

Test script: `packages/state-core/scripts/test-v3-core.mjs`  
Covers: governance init, cognitive loop, guard actions (allow/confirm/warn/block), internal API, change tracker.

---

## 11. Relationship to V3.1 closure

| Rule | V3 Core compliance |
|------|-------------------|
| L3 intelligence must not write L1/L2 | Governance writes only `governance/`, `cognitive/`, `runtime/` — not `graph/knowledge.json` |
| `handoff.json` remains sole AI entry for execution context | V3 Core adds **constraints**, not a second handoff |
| Knowledge graph confidence ≥ 0.7 (canonical) | Unchanged — Guard does not modify knowledge graph |

---

## 12. Roadmap vs current state

| Item | Status | Notes |
|------|--------|-------|
| Governance Core (constitution, truth, identity) | **Done** | Bootstrap + MCP tools |
| Cognitive MVP (derived projection + user overlay) | **Done** | No dual-truth writes |
| Lightweight Guard (detect/warn/confirm/block) | **Done** | `check_action`, no approval UI |
| Adapter guard session + optional hook | **Done** | `adapterPreWriteHook`, `guard-session.json` |
| Internal in-process API | **Done** | Not HTTP |
| **Module freeze** | **Active** | `V3_CORE_FREEZE_VERSION` — no new modules |
| Truth full-repo AST scan | Deferred | Registry + snippet only |
| MCP middleware (force all host tool calls) | Deferred | Soft + adapter hook |
| REST public API | Deferred | V3.2 Priority 4 |
| Dashboard approval workflow | **Not planned** | Explicitly out of scope |

---

## 13. Related docs

| Doc | Topic |
|-----|-------|
| [ARCHITECTURE_V3.md](./ARCHITECTURE_V3.md) | V3.1 understanding + knowledge graph |
| [ENGINEERING_CLOSURE.md](./ENGINEERING_CLOSURE.md) | Frozen L0–L3 boundaries |
| [MCP.md](./MCP.md) | MCP install and host setup |
| [INSTALL.md](./INSTALL.md) | IDE, MCP, CLI install |
| [DASHBOARD.md](./DASHBOARD.md) | Terminal dashboard |
| [packages/mcp/README.md](../packages/mcp/README.md) | MCP package quick start + 0.9.5 notes |
