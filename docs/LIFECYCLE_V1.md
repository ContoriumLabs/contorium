# Knowledge Lifecycle (LIFECYCLE)

Contorium v3.2 adds a **Knowledge Lifecycle** layer on top of ADR decisions. It tracks whether project knowledge is still trustworthy — **how stale** it is and **why** it may no longer be authoritative (Validity-Aware v2, schema `contorium.lifecycle.v2`).

## Artifacts

All lifecycle data lives under `.contora/lifecycle/`:

| Path | Purpose |
| --- | --- |
| `index.json` | Full lifecycle projection (decisions + health + review queue) |
| `review-queue.json` | Prioritized review items |
| `decisions/<id>.json` | Per-decision metadata (owner, verification, expiry) |

Lifecycle is rebuilt on **Sync** via `persistKnowledgeLifecycle()` and is a **projection** of cognitive events + ADRs — not a second source of truth.

## Dimensions

Each decision receives a multi-dimensional trust score:

- **Source** — ADR presence and status
- **Freshness** — age since verification / last use
- **Conflict** — ADR contradictions + code tension scans
- **Ownership** — assigned owner or reviewer
- **Verification** — manual, automatic, or LLM-assisted confirmation
- **Consistency** — alignment with evolution chain
- **Usage** — recent references in events

Project-level **Knowledge Health** aggregates these into freshness, conflict, review debt, and overall score.

## CLI

```bash
contorium lifecycle              # Knowledge Health dashboard
contorium review                 # Review queue only
contorium lifecycle owner <id> --owner <name>
contorium lifecycle verify <id> [--type manual|automatic|llm_assisted] [--by <name>]
contorium lifecycle expire <id> --days <n>
```

## Ask Contorium

| Question | Route |
| --- | --- |
| What needs review? | `review` |
| Knowledge health / stale decisions? | `knowledge_health` / `lifecycle` |
| Why was X decided? | `decision` + lifecycle trust overlay |

Non-decision answers (history, entity, state) append **lifecycle trust warnings** when stale or conflicted decisions are referenced.

## IDE

Sidebar **Explore** menu:

- **Review Queue** — items needing attention
- **Knowledge Health** — lifecycle dimensions
- **Set Owner** / **Verify Decision** — write metadata without CLI

## MCP Tools

| Tool | Description |
| --- | --- |
| `get_knowledge_health` | Lifecycle dashboard (kernel mode `lifecycle`) |
| `get_review_queue` | Review queue (kernel mode `review`) |
| `set_decision_lifecycle_meta` | Update owner, verification, expiry |

## Dashboard

Terminal dashboard (`contorium dashboard`) loads lifecycle into state:

- **Cognitive Health** stream — layered: Lifecycle · PIL · Cognitive
- **Governance lens (B)** — Knowledge Governance block with review queue

## Code Contradiction Scan

On sync, recent file paths and bounded file contents are scanned for **tension** against accepted ADRs (e.g. JWT decision vs OAuth code). High-confidence hits add conflict evidence and suggest re-verification.

## Validity-Aware Lifecycle (v2)

Each decision includes a **validity causality** layer:

| Field | Meaning |
| --- | --- |
| `validity_state` | `VALID` · `DECAYING` · `NEEDS_REVALIDATION` · `INVALIDATED` |
| `validity_signals[]` | Causal triggers (type, severity, reason, evidence) |
| `decay_penalty` | Confidence reduction from active signals |

**Decay triggers:** code/architecture drift · dependency change/removal · owner change · assumption failure · superseded / ADR conflict.

**Surfaces:** Review queue adds `invalidation_trigger`; Ask decision answers show **Validity**, **Why**, and **Suggested action**. Same engine on IDE, CLI, MCP, and Dashboard.

Implementation: `packages/state-core/src/lifecycle/` (`invalidation.ts`, `assumption.ts`, `dependencyScanner.ts`, …).

## Related

- PIK (Project Intent Kernel): `.contora/intent/kernel.json`
- Cognitive Health: missing WHY, stale ADR (complementary to lifecycle trust)
- Governance v4: change review (orthogonal to decision lifecycle)
