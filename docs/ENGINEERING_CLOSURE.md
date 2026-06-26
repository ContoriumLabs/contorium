# Contorium V3.1 — Final Engineering Closure

> **Frozen layer** — `closureVersion: "1"` in `knowledge.json` metadata.  
> Do not add features here; only bugfixes that preserve these boundaries.  
> **PIL v3.0 operations:** [PIL_RUNTIME.md](./PIL_RUNTIME.md)

Contorium at V3.1 is a **Project Cognitive Operating System**: workspace events compile into canonical state; the knowledge graph is the single structural truth; everything else is projection.

**CIL v3 (user layer):** [CIL_FREEZE.md](./CIL_FREEZE.md) — Cognitive Events are the CIL fact source; Snapshot, Knowledge Graph, Health are CIL projections rebuilt on sync.

---

## 1. System boundaries (data layers)

```text
L0  Execution truth     events · git · workspace files
L1  Canonical state     state.json · snapshot.md · handoff.json
L2  Cognitive graph     knowledge.json (canonical structure only)
L3  Inference (isolated) intelligence · intent-graph · AI speculation
```

### Hard rules

| Rule | Enforcement |
|------|-------------|
| L3 **never** writes L1/L2 | No import of `intelligence/` or `intent-graph/` in `knowledgeGraphBuilder` |
| L3 **never** in snapshot/handoff | `snapshot.json` built from canonical mappings only |
| `confidence < 0.7` | Stored in `inferenceMappings`; excluded from `intentMappings`, `supports_intent` edges, snapshot |
| AI/prompt **never** creates graph nodes | Graph = f(events, state, git, L2 intents) only |

L3 may appear in **Cortex UI** (Reason trace inference section) — display only.

---

## 2. Graph canonical rule

```text
knowledge.json = single source of truth
```

| Artifact | Role |
|----------|------|
| `knowledge.json` | Canonical graph |
| `snapshot.json` | Compression projection |
| MCP / CLI / IDE export | Read projections |
| Cortex UI | Read projections — **no compute, no write** |

Graph generation:

```text
Graph = f(events, state, git, L2 intents, hotspots)
```

Forbidden: AI-generated nodes, prompt-generated edges.

---

## 3. Confidence standard (frozen)

### Formula

```text
confidence = clamp(
  0.5 × semanticSimilarity +
  0.3 × temporalRecency +
  0.2 × gitActivity,
  0, 1
)
```

Implementation: `packages/state-core/.../knowledgeGraph/confidence.ts`

### Semantics

| Range | Meaning | In canonical graph? |
|-------|---------|---------------------|
| 0.9–1.0 | Strong structural relation | Yes |
| 0.7–0.9 | High-probability link | Yes |
| 0.5–0.7 | Weak link | Cortex inference only |
| < 0.5 | Excluded | No |

**Threshold:** `GRAPH_CANONICAL_MIN_CONFIDENCE = 0.7`

---

## 4. Hotspot rules

Hotspot = **activity**, not importance.

| Concept | Meaning |
|---------|---------|
| Hotspot | Edit + git + intent activity |
| Intent | Goal (L2) |
| Function | Execution unit |

### Admission (AND gate)

Must satisfy:

- edit frequency > 0
- git activity > 0 (waived if no git data in workspace)
- intent linkage > 0

### Lifecycle

```text
active (score ≥ 0.5) → cooling (≥ 0.3) → stale → removed (not stored)
```

Implementation: `hotspotBuilder.ts`

---

## 5. Snapshot rules

Snapshot is **compressed cognition**, not a second database.

```text
snapshot = compression(canonical graph, weights)
```

| Field | Rule |
|-------|------|
| `topIntents` | Top 5 by intent score |
| `topHotspots` | Top 10, exclude `stale` |
| `topFunctions` | Top 10 by confidence × hotspot |
| `nextActions` | L2 `next_actions`, else intent-gap derivation |

### Rebuild triggers

| Trigger | Condition |
|---------|-----------|
| `git_commit` | New commit hash vs `meta.lastCommitHash` |
| `file_batch` | ≥ 5 changed files |
| `intent_change` | Goal/intent text changed |
| `idle` | ≥ 60s since last build |
| `change` | Any other qualifying change |

Implementation: `rebuildTrigger.ts` · recorded in `meta.rebuildTrigger`

---

## 6. Cortex UI rules

### Show

- **State:** workflow, sync, handoff execution
- **Structure:** knowledge graph tree, hotspots (with lifecycle)
- **Inference (folded):** reason trace + weak inference mappings

### Do not show

- Raw JSON dumps
- Event lists
- AST / tree-sitter output
- Embedding vectors

Cortex is **projection-only** — it reads `knowledge.json` and never mutates it.

---

## 7. Stable pipeline (V3.1 closure)

```text
Workspace Events
        ↓
State Builder (L0–L1)
        ↓
Graph Engine (L2 canonical)
        ↓
Rules Layer (Confidence / Hotspot / Version)
        ↓
Snapshot Engine (compression)
        ↓
Cortex UI (projection)
        ↓
MCP / CLI / IDE adapters
```

---

## 8. Success criteria (frozen)

- Graph growth is bounded by canonical confidence ≥ 0.7
- Snapshot replaces full graph in export and MCP handoff paths
- Cortex displays only; all computation lives in state-core

---

## 9. Code map

| Module | Path |
|--------|------|
| Closure constants | `knowledgeGraph/closureConstants.ts` |
| Confidence | `knowledgeGraph/confidence.ts` |
| Hotspots | `knowledgeGraph/hotspotBuilder.ts` |
| Snapshot | `knowledgeGraph/snapshotBuilder.ts` |
| Rebuild triggers | `knowledgeGraph/rebuildTrigger.ts` |
| Builder | `knowledgeGraph/knowledgeGraphBuilder.ts` |
| Cortex projection | `src/cognition/knowledgeGraphView.ts` |

---

## 10. Version freeze

| Field | Value |
|-------|-------|
| Product | 0.9.1 |
| Engine | KNOWLEDGE_ENGINE_VERSION 3.1.0 |
| Closure | closureVersion **1** — see [ENGINEERING_CLOSURE.md](./ENGINEERING_CLOSURE.md) |
| Schema | schemaVersion **1** |

Next work should extend via **new closureVersion**, not silent rule drift.
