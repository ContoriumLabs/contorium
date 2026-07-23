# Contorium — Three-Surface Information Architecture

> How IDE, CLI, and MCP divide responsibility.

---

## Surface roles

| Surface | User | Answers |
|---------|------|---------|
| **IDE** | Developer in editor | Where am I? What happened? What next? Why? |
| **CLI** | Power user / scripts | Debug, audit, batch query, dashboard |
| **MCP** | AI Agent | Runtime API (invisible to humans) |

```text
         IDE (simple home + Explore)
              │
    CLI (full command set) ──┼── MCP (all tools)
              │
         @contora/state-core
              │
           .contora/
```

---

## User layer (what humans should see first)

| Action | IDE | CLI | MCP |
|--------|-----|-----|-----|
| **Ask** | Home · Ask Contorium | `contorium ask` · `ask --suggest` | `ask_project` |
| **History** | Explore → History | `contorium history` | `get_project_history` |
| **Decisions** | Explore → Decisions (validity overlay) | `contorium decisions` | `get_decisions` |
| **Review / Lifecycle** | Explore → Review Queue · Knowledge Health | `contorium review` · `contorium lifecycle` | `get_review_queue` · `get_knowledge_health` |
| **Next** | Home · Suggested actions | `contorium next` | `get_next_actions` |
| **Transfer** | Home · Transfer ▼ | `contorium transfer --mode=…` | `transfer_project` |

---

## Advanced layer (Explore / CLI / MCP only)

| Action | CLI | MCP |
|--------|-----|-----|
| Impact | `contorium impact <mod>` | `get_blast_radius` |
| Health | `contorium health` | `get_cognitive_health` |
| Knowledge Lifecycle | `contorium lifecycle` · `contorium review` | `get_knowledge_health` · `get_review_queue` |
| DNA | `contorium dna` | `get_project_dna` |
| Replay | `contorium replay` | `get_handoff_replay` |
| Entity | `contorium entity mcp` | `get_entity_knowledge` |

IDE: **Explore** panel only — not on home screen.

---

## PIL layer (storage — IDE Developer / CLI / MCP)

| Group | CLI | MCP |
|-------|-----|-----|
| Inspect | `contorium inspect …` | `inspect_*` |
| Capture | `contorium capture …` | `capture_*` |
| Sync | `contorium sync` | bootstrap / implicit |

IDE: **Developer** fold (Capture, Sync, PIL metrics) — not default view.

---

## Transfer (unified)

One verb, multiple modes:

```bash
contorium transfer --mode=context      # default AI continuation (~300–800 tokens)
contorium transfer --mode=intelligence # full export
contorium transfer --mode=story        # project narrative
contorium transfer --mode=essence      # compressed essence
contorium transfer --mode=handoff      # compact runtime handoff
```

Legacy: `transfer context`, `transfer intelligence`, `transfer handoff` still work.

MCP: `transfer_project` with `mode` parameter.

IDE: **Transfer ▼** menu — Context · Story · Essence · Handoff · Intelligence (advanced).

---

## Capability Boundary Matrix

Narrative features must not overlap. Each answers **one** question:

| Capability | Question it answers | Output | Overlap guard |
|------------|---------------------|--------|---------------|
| **Story** | What happened in this project? | Timeline + decisions + events narrative | Not a fingerprint; not replay frames |
| **Essence** | What is the compressed core for AI? | Short markdown for transfer | Not full story; not identity traits |
| **DNA** | What are this project's stable traits? | Architecture · Memory · Interaction · State · Goal | Not event timeline; not replay |
| **Replay** | How did the project evolve step by step? | Dated stage list (cognitive replay) | Not summary prose; not DNA traits |

**Rule:** Story / Essence / DNA / Replay are **Formatter + Query** outputs — no new Engines (see Architecture Closure Rule).

---

## IDE layout (two layers)

### Layer 1 — Home (default)

```text
Current Focus
Recent Activity
Suggested Next Actions
Ask Contorium [________]
Transfer ▼
```

### Layer 2 — Explore (collapsed)

```text
History · Decisions · Impact · DNA · Replay · Health
```

### Layer 3 — Developer (collapsed)

PIL metrics, Capture, Sync, governance, activity trace, structure field.

---

## Ask + Suggested Questions

One entry point:

- IDE: QuickPick suggestions when opening Ask
- CLI: `contorium ask --suggest` (list only) or pick then ask
- MCP: `get_suggested_questions` (agent onboarding)

`contorium questions` is a legacy alias for `ask --suggest`.

---

See also: [OVERVIEW.md](./OVERVIEW.md) · [IDE_EXTENSION.md](./IDE_EXTENSION.md) · [CLI.md](./CLI.md) · [MCP.md](./MCP.md) · [AI_LAYER.md](./AI_LAYER.md)
