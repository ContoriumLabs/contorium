# Contorium Project Intelligence Layer v1.1.3

> Architecture spec — [PIL Runtime Guide](./PIL_RUNTIME.md) · [Language Spec](./CONTORIUM_LANGUAGE_SPEC.md) · [Dimensions](./COGNITIVE_DIMENSIONS.md) · [Install](./INSTALL.md)

---

## Vision

**Contorium is an AI Project Intelligence Layer.**

Its purpose is to **capture, structure, preserve, retrieve and transfer** project intelligence across tools, sessions and models.

Contorium does **not** execute work.  
Contorium does **not** make decisions.  
Contorium does **not** replace developers.

> **Contorium records and preserves project intelligence. It does not decide for the project.**

---

## Core responsibilities

```text
Capture
↓
Structure
↓
Preserve
↓
Retrieve
↓
Transfer
```

## Out of scope

```text
Task Execution
Agent Orchestration
Code Generation
Project Recommendation
Autonomous Decision Making
Prediction · Recommendation · Autonomous Reasoning
```

---

## Intelligence model

### Core objects

| Object | Question | Examples |
|--------|----------|----------|
| **STATE** | What exists now? | Files, modules, architecture, runtime state |
| **INTENT** | Why does it exist? | Goals, principles, constraints |
| **DECISION** | How did it become this way? | Architecture decisions, tradeoffs |
| **WHY** | What reasoning led here? | Problem, context, expected value |

### Intelligence dimensions (descriptive)

| Dimension | Question | Storage |
|-----------|----------|---------|
| **TIMELINE** | When did it change? | `.contora/timeline/project_timeline.json` |
| **IMPACT** | What does it affect? | `.contora/graph/impact_graph.json` |
| **CONFIDENCE** | How trustworthy is this record? | `.contora/confidence/confidence_index.json` |

Dimensions are **descriptive** — they record facts, not recommendations.

### Intelligence systems (optional)

| System | Question | Storage |
|--------|----------|---------|
| **PROVENANCE** | Why does this intelligence exist? | `.contora/provenance/provenance_chain.json` |
| **EVOLUTION** | How has the project transformed? | `.contora/evolution/evolution_graph.json` |

**Timeline vs Evolution:** Timeline = chronological history. Evolution = structured transformation chains (e.g. Auth V1 → JWT → SSO).

---

## Extended graph

```text
TIMELINE
    │
    ▼
STATE · INTENT · DECISION · WHY
    │
    ▼
IMPACT
    │
    ▼
CONFIDENCE
```

Provenance trace-back: `WHY → DECISION → INTENT → TIMELINE EVENT`

---

## Surface definitions (v3.0 PIL Runtime)

| Surface | Role | Capability groups |
|---------|------|-------------------|
| **MCP** | Project Intelligence Interface for agents | **Inspect** · **Transfer** · **Capture** |
| **CLI** | Project Intelligence Terminal | **Inspect** · **Transfer** · **Capture** (+ audit/derive) |
| **IDE** | Project Intelligence Workspace | **Capture** · Visualize · **Transfer** |
| **Dashboard** | Cognitive State view (terminal TUI) | Observe streams · view modes · shortcuts |

Operational guide: [PIL_RUNTIME.md](./PIL_RUNTIME.md)

Legacy surface names (v2.x): MCP *query*, CLI *derive*, IDE *observe* — superseded by Inspect / Transfer / Capture naming in v3.0 public APIs.

---

## Data ownership

Single source of truth:

```text
.contora/
  state.json
  identity/
  intent/
  governance/          ← decision
  timeline/
  graph/               ← impact
  confidence/
  provenance/
  evolution/
  intelligence/        ← repository snapshot
```

---

## North star

Contorium does not manage tasks.  
Contorium does not manage agents.  
Contorium does not execute projects.

**Contorium preserves project intelligence.**

---

## Analogy

Contorium is closer to:

```text
Git + Knowledge Graph + Project Memory
```

Not:

```text
AutoGPT + Agent + Architecture Advisor
```

---

## Health & Coverage (v1.2+)

Measures **project intelligence asset completeness** — not code quality or recommendations.

### Health formula (frozen)

```text
health_score =
  0.35 × intelligence_completeness
+ 0.25 × decision_coverage
+ 0.20 × intent_linkage
+ 0.20 × provenance_coverage
```

| Score | Category |
|-------|----------|
| ≥ 0.85 | Excellent |
| ≥ 0.70 | Healthy |
| ≥ 0.50 | Incomplete |
| < 0.50 | Fragmented |

Artifact: `.contora/intelligence/health.json`

### Knowledge Coverage

```text
knowledge_coverage = covered_modules / total_modules
```

A module is **covered** when it has **STATE** presence and at least one of **INTENT · DECISION · WHY**.

---

## Versioning (v1.1.3)

| Field | Meaning | Value |
|-------|---------|-------|
| `repository_version` | Contorium runtime version | `1.1.3` |
| `schema_version` | Artifact format version | `1.1.3` |

Both appear in `.contora/intelligence/repository_state.json`. Release version is unified — no split between runtime and schema.

---

## Release (v1.1.3)

Delivered in this release:

| Track | Scope |
|-------|-------|
| **Core** | STATE · INTENT · DECISION · WHY · TIMELINE · IMPACT · CONFIDENCE · PROVENANCE · EVOLUTION |
| **v1.1** | Schema validation · artifact migration · cross-tool `tool_sources` on identity |
| **Metrics** | Weighted `health_score` · `knowledge_coverage` · `decision/decision_log.json` |
| **Surfaces** | Dashboard: Health · Coverage · Timeline · Evolution · Provenance · Impact · CLI `cognition inspect health` |

Release version: `1.1.3` · pipeline_version: `2`

### `.contora` layout (v1.1.3)

```text
.contora/
  intelligence/          repository_state.json · snapshot.json · health.json
  state/state.json
  intent/                intent_graph.json · intent_nodes.json · why.json
  decision/              decision_graph.json · decision_log.json
  timeline/project_timeline.json
  graph/                 impact_graph.json · knowledge_graph.json
  confidence/confidence_index.json
  provenance/provenance_chain.json
  evolution/evolution_graph.json
  identity/project_identity.json
```

Legacy alias: `graph/knowledge.json` → migrated to `graph/knowledge_graph.json` on sync.

Like Git records *who / when / what / why* — Contorium records *project cognition assets* for AI tools to query.
