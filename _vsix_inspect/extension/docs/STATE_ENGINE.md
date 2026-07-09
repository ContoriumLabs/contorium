# Contorium State Engine (v1 + v2 Safe)

> **PIL context:** [PIL_RUNTIME.md](./PIL_RUNTIME.md) · [PROJECT_INTELLIGENCE_LAYER.md](./PROJECT_INTELLIGENCE_LAYER.md)

Install and daily use: [IDE_EXTENSION.md](./IDE_EXTENSION.md) · [MCP.md](./MCP.md) · [README](../README.md#documentation-install--use--uninstall)

## v2 Safe State Engine (current)

v2 adds **conflict audit** and **source tagging** without auto-resolution:

| Capability | v1 | v2 |
|------------|----|----|
| State generation | ✔ | ✔ |
| Normalization / Task isolation | ✔ | ✔ |
| Source tags `(from IDE/MCP/…)` | — | ✔ |
| Conflict detection | — | ✔ |
| Auto decision | — | ❌ (forbidden) |

### v2 pipeline

```
L2 State Builder (tagged entries)
  → L3 Normalization
  → Conflict Detector (UNRESOLVED only)
  → L4 Snapshot (+ conflicts block when present)
  → L5 Intent (sidebar / export, no backflow)
```

### v2 artifacts

| Path | Purpose |
|------|---------|
| `.contora/state-engine/conflicts.json` | Unresolved conflicts for MCP + sidebar |
| `project-state.json` `engine_version: 2` | Tagged module/decision lines |

### Principles (v2)

1. **No Auto Decision** — system surfaces conflicts, never picks truth  
2. **Conflict Transparency** — shown in snapshot, export, sidebar, MCP  
3. **Snapshot Stability** — Intent cannot change L4  

### MCP (additive)

- `get_state_conflicts` — read conflict audit artifact  

---

# Contorium State Engine v1.0

Contorium is a **Project State Operating System** — not a chat memory or prompt concatenation tool.

## Layer model (strict separation)

| Layer | Name | Source in repo | Rules |
|-------|------|----------------|-------|
| **L0** | Task Anchor | `state.currentTask` → `extractTaskAnchor()` | User alignment only. No inference, no intents, no next actions. |
| **L1** | Event Layer | `EventStore`, scanner, git | Facts only (`file_edit`, `file_save`, …). |
| **L2** | State Builder | `src/state-builder/builder.ts` | Describes what happened (modules, problems, milestones). **No Task, no Intent graph input.** |
| **L3** | Normalization | `src/state-engine/normalization.ts` | Dedupe, strip Task echo, compress similar next actions. |
| **L4** | Snapshot | `src/state-builder/snapshot.ts` → `.contora/state-builder/project-snapshot.md` | Output for AI: goal, stage, modules, problems, milestones, next actions (gap-based). |
| **L5** | Intent (weak) | `src/intelligence/`, `src/intent-graph/` | Auxiliary only. **Cannot modify L4.** |

## Pipeline (stable order)

```
L0 Task Anchor (sidebar "Current focus")
        ↓ (isolated)
L1 Events
        ↓
L2 State Builder (events + summary, no task)
        ↓
L3 Normalization
        ↓
L4 Snapshot (.contora/state-builder/)
        ↓
L5 Intent graph + intelligence (sidebar / optional export section)
```

Implemented in `CognitionPipeline.runUpdate()`:

1. `buildStateSummary` — events only (no `currentTask` in intent derivation)
2. `buildIntentGraph` — parallel L5 artifact
3. `rebuildProjectStateArtifacts` — L2 → L3 → L4 (graph **not** passed in)

## Module map

```
extension.ts
  ├─ Scanner / EventStore          → L1
  ├─ state.json (unchanged schema) → runtime continuity
  └─ CognitionPipeline
        ├─ intelligence/           → L5 summary (state-summary.json)
        ├─ intent-graph/           → L5 graph (graph.json)
        └─ state-builder/          → L2 raw state
              └─ state-engine/     → L3 normalize + L0 anchor + gap next-actions
```

## Copy AI-ready context (v2.1 converged)

Markdown section order:

1. **TASK ANCHOR** — user focus only (no meta)
2. **PROJECT SNAPSHOT** — pure facts (source tags stripped at export)
3. **WORKING CONTEXT** — active files + recent work (merged)
4. **INSIGHTS** — max 3 lightweight lines (no weights / intent graph)
5. **NOTES** / **INSTRUCTION** — when set

Removed from export: `INFERRED BEHAVIOR`, `STATE CONFLICTS`, `(from IDE/MCP)` tags, layer meta comments.

Conflicts remain in sidebar + MCP (`get_state_conflicts`); not copied into AI handoff.

## Core rules

1. **Task isolation** — `TASK ≠ input to inference`
2. **Intent no backflow** — Intent graph does not feed `buildProjectBuiltState`
3. **Next actions** — `deriveNextActionsFromGaps()` only; never copy Task or intent graph lines
4. **Traceability** — modules ← file events; problems ← git/MCP; milestones ← creates/commits

## Artifacts

| Path | Layer |
|------|-------|
| `.contora/state.json` | Runtime (unchanged) |
| `.contora/intelligence/state-summary.json` | L5 |
| `.contora/intent-graph/graph.json` | L5 |
| `.contora/state-builder/project-state.json` | L2+L3 (+ `task_anchor` metadata) |
| `.contora/state-builder/project-snapshot.md` | L4 |

## MCP

Existing tools unchanged. `get_project_snapshot` / `get_project_state` return L4 artifacts after normalization.
