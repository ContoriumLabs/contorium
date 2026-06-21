# Contorium Intelligence Dimensions & Systems

> TIMELINE · IMPACT · CONFIDENCE — descriptive dimensions. PROVENANCE · EVOLUTION — trace systems.

All dimensions are **descriptive** (record facts). They do **not** recommend, predict, or decide.

See: [PROJECT_INTELLIGENCE_LAYER.md](./PROJECT_INTELLIGENCE_LAYER.md) · [CONTORIUM_LANGUAGE_SPEC.md](./CONTORIUM_LANGUAGE_SPEC.md)

---

## Cognitive coordinate system

### Four cognition cores

| Layer | Question | Artifacts |
|-------|----------|-----------|
| **STATE** | What exists now? | `state.json`, `handoff.json` |
| **INTENT** | Why does it exist? | `.contora/intent/intent_graph.json` |
| **DECISION** | How did it evolve? | `.contora/governance/decision_graph.json` |
| **WHY** | What is the reasoning? | `.contora/intent/why.json` |

### Three extension dimensions

| Dimension | Question | Artifact |
|-----------|----------|----------|
| **TIMELINE** | When did it change? | `.contora/timeline/project_timeline.json` |
| **IMPACT** | What does it affect? | `.contora/graph/impact_graph.json` |
| **CONFIDENCE** | How trustworthy is this record? | `.contora/confidence/confidence_index.json` |

### Intelligence systems

| System | Question | Artifact |
|--------|----------|----------|
| **PROVENANCE** | Why does this exist? | `.contora/provenance/provenance_chain.json` |
| **EVOLUTION** | How did it transform? | `.contora/evolution/evolution_graph.json` |

```text
        Project Intelligence Space

        STATE
          │
INTENT ─ DECISION ─ WHY
          │
       TIMELINE
          │
       IMPACT
          │
     CONFIDENCE
```

---

## Part 1 — Data model & storage

### TIMELINE (not a log)

Structured evolution events with before/after snapshots and entity linking:

```json
{
  "event_id": "evt_dec_001_1718880000",
  "timestamp": 1718880000,
  "event_type": "decision | intent_change | state_change | refactor",
  "entity_id": "dec_001",
  "before_snapshot": {},
  "after_snapshot": {},
  "trigger_source": "IDE | MCP | CLI | Git",
  "linked_intent": "auth_system",
  "impact_summary": "refactored auth module"
}
```

| Event type | Source | Meaning |
|------------|--------|---------|
| `state_change` | sync | Workspace state hash changed |
| `intent_change` | cognition | Intent graph updated |
| `decision` | governance | Decision provenance node |
| `refactor` | git | Code structure change |

**Legacy:** `.contora/timeline.json` remains the git-centric V3.1 timeline (`get_project_timeline`).

### IMPACT (not dependency graph only)

Propagation model with blast radius and risk scoring:

```json
{
  "source_entity": "dec_001",
  "change_type": "architecture_update",
  "impacted_nodes": [{ "module": "auth", "impact_level": 0.9 }],
  "blast_radius": 0.82,
  "risk_score": 0.74
}
```

### CONFIDENCE (formerly Stability)

```json
{
  "entity_id": "project",
  "confidence_score": 0.92,
  "category": "stable | evolving | experimental",
  "freshness": "recent | historical",
  "signal_sources": {
    "change_frequency": 0.3,
    "decision_volatility": 2,
    "intent_changes": 1
  }
}
```

Embedded on core artifacts as optional `cognition: { confidence, category, freshness }`.

---

## Part 2 — Derivation & trigger chain

```text
IDE save / MCP call / CLI sync
        ↓
change detection
        ↓
timeline event derive
        ↓
impact propagation calculate
        ↓
stability index update
        ↓
state + intent + decision sync
```

Implemented in `@contora/state-core`:

- `syncProjectIntelligenceDimensions()` — derive and persist dimensions + systems
- `syncProjectIntelligenceRepository()` — repository snapshot (`.contora/intelligence/`)

Hooked from `syncIntelligenceLayer()` after core object sync.

### Confidence categories

| Score | Category |
|-------|----------|
| 0.8 – 1.0 | `stable` |
| 0.5 – 0.8 | `evolving` |
| 0 – 0.5 | `experimental` |

---

## Part 3 — Repository snapshot

Artifacts under `.contora/intelligence/`:

| File | Purpose |
|------|---------|
| `repository_state.json` | Dimension counters |
| `snapshot.json` | Unified inspect summary |

No inference engine — **Capture · Structure · Preserve** only.

---

## API (read-only)

### MCP (PIL v3.0 — preferred)

| Tool | Dimension |
|------|-----------|
| `inspect_timeline` | TIMELINE (filters: `from`, `to`, `type`, `intent`) |
| `inspect_impact` | IMPACT (filter: `entity_id`) |
| `inspect_confidence` | CONFIDENCE (filter: `entity_id`) |
| `inspect_provenance` | PROVENANCE (filter: `anchor`) |
| `inspect_evolution` | EVOLUTION (filter: `anchor`) |
| `inspect_health` | Aggregated intelligence health |

Legacy aliases (still supported): `get_project_evolution_timeline`, `get_impact_graph`, `get_confidence_index`, `get_stability_index`, `get_provenance_chain`, `get_evolution_graph`.

### CLI

Dimensions refresh automatically on `contorium sync` and governance/decision flows.

```bash
contorium inspect timeline|impact|confidence|provenance|evolution|health [path]
```

Or read artifacts directly under `.contora/`.

---

## Design constraints

| Rule | Requirement |
|------|-------------|
| TIMELINE ≠ log | Must include snapshot + entity linking |
| IMPACT ≠ deps only | Must include propagation + risk scoring |
| STABILITY ≠ static | Must use time-dependent signals |
| No prescriptive output | Must not recommend or predict actions |

---

## Summary

> Contorium v1.1.3 is a descriptive Project Intelligence Layer: temporal, causal, and confidence-aware records — not logs, execution traces, or agent recommendations.
