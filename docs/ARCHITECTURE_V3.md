# Contorium V3.1 — Project Understanding Layer

V3.1 converges V3 into a **3+1 artifact model**, adds a **Project Cognitive Graph** (Knowledge Graph), and makes **handoff.json the sole AI entry point** for execution context.

## Design goal

> Contorium is not a code intelligence system.  
> It is an **AI Context Compiler for Code Evolution**.

Track change. Infer impact. Transfer understanding. Remember how code evolved.

## Architecture (end-to-end)

```text
Workspace Events (IDE) / Git scan (CLI/MCP)
        ↓
Parser (regex default · Tree-sitter optional)
        ↓
Function Graph (.contora/graph.json — change neighborhood)
        ↓
Knowledge Graph (.contora/graph/knowledge.json)
        ↓
   ┌────────────────────────────┐
   │ Version    (meta)          │
   │ Confidence (edges/maps)    │
   │ Hotspot    (edit+git+intent)│
   │ Snapshot   (AI Handoff)    │
   └────────────────────────────┘
        ↓
IDE Cortex UI · MCP Tools · CLI · One-click Export
```

**Single engine:** `@contora/state-core` — IDE / MCP / CLI are Runtime Adapters only.

## Artifact model (3 + 1 + cognitive graph)

| File | Role |
|------|------|
| `graph.json` | Current structural relationships (change neighborhood) |
| `change.json` | Current change semantics (`key_changes`) |
| `handoff.json` | **Sole AI execution entry** — goal, focus, impact, next actions |
| `timeline.json` | Lightweight code evolution (recent commits) |
| `graph/knowledge.json` | Project Cognitive Graph (Intent → Module → File → Function) |
| `graph/snapshot.json` | Compact cognitive summary for export / MCP |
| `graph/hotspots.json` | Project activity hotspots |
| `graph/metadata.json` | Version layer (`schemaVersion`, `graphBuildId`) |

### Converged away (V3.1)

- `intent.json` → merged into `handoff.current_focus`
- `impact.json` → merged into `handoff.impact_summary`

Legacy files are removed on next pipeline run. MCP `get_project_impact` / `get_project_intent` remain as **deprecated** wrappers reading from handoff.

## Pipeline

```text
Git diff + state paths → change.json → graph.json → handoff.json → timeline.json
                                                      ↓
                                            knowledge graph + snapshot
```

Engines in `@contora/state-core/understanding/`:

1. **Change detector** — git diff + `state.json` paths
2. **Graph builder** — regex fast path + symbolValidator (tree-sitter ready)
3. **Impact + intent fusion** — internal only; output lands in handoff
4. **Timeline tracker** — last 5 commits from real `git log`
5. **Knowledge graph builder** — intent↔function mapping, hotspots, snapshot
6. **Version normalize** — legacy `version:1` graphs upgraded on read

### Data sources (no mock layer)

| Signal | Source |
|--------|--------|
| Changed files | `git diff` + `state.json` recent/open/git paths |
| Edit frequency | IDE events / change artifact file list |
| Git activity | `timeline.json` commits + `state.json` gitStaged/gitWorking |
| Intent text | L4 `project_goal`, `currentTask`, L2 `next_actions` |
| Confidence | Intent↔function similarity score; structural edges from graph |
| Package version in meta | Read from `@contora/state-core/package.json` at runtime |

Heuristic thresholds (e.g. hotspot weights 0.4/0.2/0.3/0.1) are scoring rules, not placeholder data.

## handoff.json (V3.1 schema)

```json
{
  "version": 2,
  "goal": "...",
  "current_focus": "...",
  "key_changes": [],
  "impact_summary": { "risk": "medium", "affected_modules": [], "affected_functions": [] },
  "next_actions": [{ "action": "review", "target": "...", "reason": "..." }],
  "context_graph_refs": ["function:foo"]
}
```

## MCP tools

| Tool | Status |
|------|--------|
| `get_project_handoff` | Core — **preferred AI execution entry** |
| `get_project_graph_snapshot` | Core — **preferred cognitive summary** |
| `get_project_knowledge_graph` | Core — full graph; optional `minConfidence` |
| `get_project_graph` | Core — change neighborhood |
| `get_project_change` | Core |
| `get_project_timeline` | Optional |
| `get_project_impact` | Deprecated → handoff |
| `get_project_intent` | Deprecated → handoff |

Memory / L4 / L5 tools unchanged: `get_workspace_context`, `get_project_snapshot`, `get_project_state`, `get_project_intelligence`, `get_intent_graph`, `get_active_intents`, `get_state_conflicts`, `store_memory`, `search_memory`, `get_memory`.

## CLI (mirrors MCP)

```bash
contorium handoff .              # same as get_project_handoff
contorium graph-snapshot .       # same as get_project_graph_snapshot
contorium knowledge .            # same as get_project_knowledge_graph
contorium knowledge . --min-confidence 0.7
contorium export .               # canonical markdown (includes COGNITIVE SNAPSHOT)
contorium export . --format json
```

## IDE

### Sidebar

- **Main column:** Task anchor, L4 snapshot, handoff summary, git/working context
- **AI Cortex (collapsed):** Knowledge Graph tree, Hotspots, Function graph, Impact, Reason trace

### One-click copy (`Copy AI-ready context`)

Canonical markdown sections (when data exists):

1. `# TASK ANCHOR`
2. `# PROJECT SNAPSHOT` (L4 pure)
3. `# WORKING CONTEXT`
4. `# COGNITIVE SNAPSHOT` (from `graph/snapshot.json` — replaces full graph in export)
5. `# CHANGE SET` / `# IMPACT SET`
6. `# AI HANDOFF (V3.1)`
7. `# CODE EVOLUTION`
8. `# INSIGHTS` / `# NOTES` / `# INSTRUCTION`

JSON export includes `cognitiveSnapshot` when knowledge graph exists.

## Non-goals

- Full static analysis / type inference
- Whole-repo graphs
- Git analytics product scope

## Version

**0.8.1** — V3.1 convergence + cognitive graph (Version/Confidence/Hotspot/Snapshot) + timeline + hybrid symbol validation.

See also: [STATE_ENGINE.md](./STATE_ENGINE.md) · [INSTALL.md](./INSTALL.md) · [MCP.md](./MCP.md) · [CLI.md](./CLI.md) · [IDE_EXTENSION.md](./IDE_EXTENSION.md) · **[ENGINEERING_CLOSURE.md](./ENGINEERING_CLOSURE.md)** (frozen rules)
