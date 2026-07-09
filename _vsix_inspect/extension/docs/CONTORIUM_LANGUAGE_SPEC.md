# Contorium Language Spec v1

> Project Intelligence Layer — allowed vocabulary for public APIs (MCP, CLI, IDE).

Contorium **captures, structures, preserves, retrieves and transfers** project intelligence.  
It does **not** execute, recommend, or decide.

See [PROJECT_INTELLIGENCE_LAYER.md](./PROJECT_INTELLIGENCE_LAYER.md).

---

## Core objects

| Layer | Question | Artifacts |
|-------|----------|-----------|
| **STATE** | What exists now? | `state.json`, `handoff.json` |
| **INTENT** | Why does it exist? | `.contora/intent/intent_graph.json` |
| **DECISION** | How did it evolve? | `.contora/governance/decision_graph.json` |
| **WHY** | What is the reasoning? | `.contora/intent/why.json` |

## Intelligence dimensions (descriptive)

| Dimension | Question | Artifacts |
|-----------|----------|-----------|
| **TIMELINE** | When did it change? | `.contora/timeline/project_timeline.json` |
| **IMPACT** | What does it affect? | `.contora/graph/impact_graph.json` |
| **CONFIDENCE** | How trustworthy? | `.contora/confidence/confidence_index.json` |

## Intelligence systems

| System | Artifacts |
|--------|-----------|
| **PROVENANCE** | `.contora/provenance/provenance_chain.json` |
| **EVOLUTION** | `.contora/evolution/evolution_graph.json` |

---

## Allowed verbs (public API)

| Verb | Meaning | Examples |
|------|---------|----------|
| **inspect** | Read-only query | `inspect_state`, `contorium inspect health` |
| **transfer** | Export intelligence for AI continuity | `transfer_context`, **Transfer Context** |
| **capture** | Write intelligence records | `capture_focus`, sidebar current focus |
| **derive** | Structure understanding records | `derive_decision_provenance`, `decision derive` |
| **synthesize** | Aggregate layers into export | `synthesize_context_payload` |
| **snapshot** | Point-in-time view | `transfer context`, decision snapshot |

Legacy verbs (`query`, `observe`, `recommend`) remain in older docs/tools but new APIs use **inspect / transfer / capture**.

---

## Forbidden verbs (new public APIs)

`run` · `execute` · `control` · `build` · `trigger` · `recommend` · `predict`

Legacy aliases may remain but must be labeled `[Legacy]`.

---

## Adapter roles

| Surface | Role |
|---------|------|
| **MCP** | Project Intelligence Query Layer — inspect · query · retrieve |
| **CLI** | Project Understanding CLI — derive · inspect · snapshot |
| **IDE** | Project Cognition Interface — observe · visualize · navigate |
| **Dashboard** | Project Cognition View — timeline · impact · confidence |

---

## Preferred MCP tools (PIL v3.0)

**Inspect:** `inspect_state` · `inspect_intent` · `inspect_decision` · `inspect_why` · `inspect_timeline` · `inspect_impact` · `inspect_confidence` · `inspect_provenance` · `inspect_evolution` · `inspect_health`

**Transfer:** `transfer_context` · `transfer_intelligence` · `transfer_handoff`

**Capture:** `capture_focus` · `capture_note` · `capture_decision`

**Governance / derive:** `derive_decision_provenance` · `synthesize_context_payload` · `inspect_cognition_ready`

Legacy aliases remain: `get_project_*`, `get_impact_graph`, `get_confidence_index`, `get_stability_index` → prefer `inspect_*` in new integrations.

---

See also: [COGNITIVE_DIMENSIONS.md](./COGNITIVE_DIMENSIONS.md) · [INSTALL.md](./INSTALL.md)
