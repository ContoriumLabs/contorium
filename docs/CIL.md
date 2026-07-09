# Cognitive Interaction Layer (CIL v3 — Frozen)

> **Architecture freeze:** [CIL_FREEZE.md](./CIL_FREEZE.md) · **Full spec:** [CIL_V3.md](./CIL_V3.md)

## What CIL is

Project Intelligence Runtime — query project history, decisions, health, and DNA. **Never executes tasks.**

## Entry point

All operations → `runCognitiveKernel()`.

## Quick commands

```bash
contorium ask "Why not Redux?"
contorium ask "What do we know now about 2024-06-18?"
contorium ask "What needs review?"
contorium ask "Is this decision still valid?"
contorium health · lifecycle · review
contorium dna --copy · questions
contorium entity mcp · essence --copy · replay
```

## Knowledge Lifecycle (decision validity)

Tracks **trust over time** for ADRs: freshness, conflicts, ownership, verification, and **validity decay** (why a decision may no longer hold). Projection under `.contora/lifecycle/`. See [LIFECYCLE_V1.md](./LIFECYCLE_V1.md).

| Command / route | Purpose |
| --- | --- |
| `contorium lifecycle` | Knowledge Health dashboard |
| `contorium review` | Review queue (incl. invalidation triggers) |
| `contorium ask` (decision intent) | Answer + validity overlay |

## Projection rule

Only `.contora/cognitive-events/` is the fact source. Snapshot, Knowledge Graph, Health are **projections** with `projection_of: cognitive_events`.

## MCP

| Tool | Purpose |
|------|---------|
| `get_suggested_questions` | Onboarding prompts |
| `get_project_dna` | Project identity fingerprint |
| `get_cognitive_health` | Health score + warnings |
| `get_knowledge_health` | Knowledge Lifecycle / decision trust |
| `get_review_queue` | Decisions needing review |
| `set_decision_lifecycle_meta` | Owner, verification, expiry |
| `get_entity_knowledge` | Knowledge Graph |
| `get_snapshot` | Time travel (+ perspective) |

Legacy `inspect_*` = PIL storage API.
