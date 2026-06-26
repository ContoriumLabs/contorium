# Contorium CIL v3 — Engineering Specification (Frozen)

> **Architecture freeze:** [CIL_FREEZE.md](./CIL_FREEZE.md)  
> **CIL** = user-facing cognition · **PIL** = storage underneath

**Product answer:**

> Git stores code history. Contorium stores project intelligence history — and lets humans and AI query it.

---

## Design principles

| Principle | Rule |
|-----------|------|
| **Kernel First** | All CIL via `runCognitiveKernel()` |
| **Projection Rule** | Only Cognitive Events are SoT; all other CIL artifacts are projections |
| **Architecture Closure Rule** | No new Engines unless Projection / Query / Formatter paths are exhausted — see [CIL_FREEZE.md](./CIL_FREEZE.md) |
| **Execution Isolation** | `is_executable: false` always |

---

## Frozen stack

```text
PIL
  ↓
Cognitive Events (SoT)
  ↓
Snapshot · Decision · Knowledge Graph · Module History · Health
  ↓
Query Router → Kernel → Action Engine
  ↓
Story · Essence · Replay · DNA · Suggested Questions
  ↓
CLI · MCP · IDE · Dashboard
```

---

## Projection Rule (mandatory)

```text
Cognitive Event (SoT)
      ↓
Decision → Snapshot → Knowledge Graph → Module History → Health
```

Every projection schema includes:

```json
{
  "projection_of": "cognitive_events",
  "derived_from": ["evt_001", "evt_002"]
}
```

---

## Time Travel perspectives

| Mode | Question |
|------|----------|
| `historical` | What did we **know on** 2024-06-18? |
| `retrospective` | What do we **know now about** 2024-06-18? |

```bash
contorium ask "What was focus on 2024-06-18?"
contorium ask "What do we know now about 2024-06-18?"
```

MCP: `get_snapshot` with `date` + optional `perspective`.

---

## Decision lifecycle

```text
Proposed → Accepted → Implemented → Superseded | Deprecated | Rejected
```

```bash
contorium ask "Why not Redux?"
# → ADR-11 superseded by ADR-17
```

---

## Kernel modes (complete)

| mode | Purpose |
|------|---------|
| `sync` | Rebuild all projections from events |
| `ask` | Natural language |
| `next` | Action suggestions |
| `history` / `decisions` / `health` / `entity` | Direct queries |
| `snapshot` | Time travel |
| `story` / `essence` / `replay` / `dna` | Narrative & compression |
| `questions` | Suggested Ask prompts |

---

## CLI reference

```bash
contorium ask "..." · next · health · decisions
contorium entity mcp · essence --copy · replay · dna --copy · questions
```

---

## MCP reference

`ask_project` · `get_cognitive_health` · `get_entity_knowledge`  
`get_project_essence` · `get_handoff_replay` · `get_project_dna` · `get_suggested_questions`  
`get_snapshot` (time travel + perspective)

---

## IDE

- **Cortex:** History · Decisions · Ask (with **Suggested Questions** quick pick)
- Command palette: DNA · Questions · Health

---

See [CIL_FREEZE.md](./CIL_FREEZE.md) for the full capability matrix and boundaries.
