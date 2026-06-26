# CIL v3 — Architecture Freeze

> **Frozen:** 2026-06 · Do not add new CIL engines without architecture review.  
> **Spec:** [CIL_V3.md](./CIL_V3.md) · **PIL:** [ENGINEERING_CLOSURE.md](./ENGINEERING_CLOSURE.md)

Contorium is a **Project Intelligence Runtime**:

> Git stores code history. Contorium stores project intelligence history — and lets humans and AI query it.

---

## Frozen stack

```text
PIL (capture · structure · preserve)
        ↓
Cognitive Events          ← sole fact source (SoT)
        ↓
Snapshot · Decision · Knowledge Graph · Module History · Health
        ↓
Query Router → Cognitive Kernel → Action Engine
        ↓
Story · Essence · Replay · DNA · Suggested Questions
        ↓
CLI · MCP · IDE · Dashboard
```

**No tenth engine.** CIL answers questions; it never executes tasks.

---

## Projection Rule (hard constraint)

Only **Cognitive Events** are the fact layer. Everything below is a **projection**:

```text
Cognitive Event (SoT)
      ↓
Decision (ADR)
      ↓
Snapshot
      ↓
Knowledge Graph
      ↓
Module History
      ↓
Cognitive Health
```

Every projection artifact MUST declare:

```json
{
  "projection_of": "cognitive_events",
  "derived_from": ["evt_001", "evt_002"]
}
```

If Event says A and a projection says B, **Event wins**. Re-run `sync` to rebuild projections.

---

## Architecture Closure Rule

> **No New Engines Rule** — the only approved way to extend CIL after freeze.

Future features **must** satisfy this gate before any new Engine is proposed:

| # | Question | If **yes** → do this | Do **not** |
|---|----------|----------------------|------------|
| **1** | Can it be implemented as a **Projection**? | Add or extend a projection over Cognitive Events (with `projection_of` + `derived_from`) | Create a new Engine |
| **2** | Can it be implemented as a **Query**? | Route through Query Router + existing Kernel mode / intent | Create a new Artifact |
| **3** | Can it be implemented as a **Formatter**? | Shape existing Kernel output (`formatter.ts`, CLI/MCP/IDE presentation) | Create a new Data Source |

**Only when all three answers are NO** may a new Engine be proposed — and it requires explicit architecture review.

```text
New feature request
      │
      ├─ Projection?  → extend .contora/ projection layer
      ├─ Query?       → extend Query Router / Kernel mode
      ├─ Formatter?   → extend output shaping only
      └─ all NO       → architecture review → maybe new Engine
```

This rule prevents **cognition for cognition's sake** — the stack stays stable; intelligence stays queryable.

---

## Time Travel perspectives

| Perspective | Question | Meaning |
|-------------|----------|---------|
| `historical` | What did we **know on** 2024-06-18? | State as recorded at that date |
| `retrospective` | What do we **know now about** 2024-06-18? | Current knowledge applied to that date (superseded ADRs annotated) |

---

## Decision lifecycle (frozen)

```text
Proposed → Accepted → Implemented → Superseded | Deprecated | Rejected
```

Query example: *Why not Redux?* → `ADR-11 superseded by ADR-17`.

---

## Capability matrix (complete)

| Priority | Capability | CLI | MCP |
|----------|------------|-----|-----|
| P0 | Events · Snapshot · Knowledge Graph · Ask | `ask` · `entity` | `ask_project` · `get_entity_knowledge` |
| P1 | Health · Decision Consistency · Actions | `health` · `decisions` · `next` | `get_cognitive_health` |
| P2 | Replay · Essence · DNA · Questions | `replay` · `essence` · `dna` · `questions` | `get_handoff_replay` · `get_project_essence` · `get_project_dna` · `get_suggested_questions` |

---

## What not to build in CIL

- Autonomous coding agents  
- Task execution (`is_executable: false` always)  
- New storage layers that bypass Cognitive Events  
- AI-generated facts written as CIL events without PIL capture  

Legacy PIL `inspect_*` remains for storage API compatibility.
