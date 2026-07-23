# Knowledge Lifecycle (LIFECYCLE)

Contorium v3.2+ tracks whether project knowledge is still trustworthy — **how stale** it is and **why** it may no longer be authoritative.

**Schema:** `contorium.lifecycle.v3` (read-compatible with `contorium.lifecycle.v2`)

## Artifacts

### Lifecycle projection

| Path | Purpose |
| --- | --- |
| `.contora/lifecycle/index.json` | Full lifecycle projection (decisions + health + review queue) |
| `.contora/lifecycle/review-queue.json` | Prioritized review items |
| `.contora/lifecycle/decisions/<id>.json` | Per-decision metadata (owner, verification, expiry, evidence) |

### Governance graphs (Validity Intelligence)

| Path | Purpose |
| --- | --- |
| `.contora/governance/assumption_graph.json` | Structured assumptions per decision |
| `.contora/governance/decision_dependency_graph.json` | Decision → assumptions / modules / deps |
| `.contora/governance/dependency_baseline.json` | Manifest package baseline for diff events |
| `.contora/governance/dismissed_impact_alerts.json` | IDE banner ignore list |

Lifecycle is rebuilt on **Sync** via `persistKnowledgeLifecycle()` and is a **projection** of cognitive events + ADRs — not a second source of truth.

## Validity state machine (v3)

```text
VALID → WARNING → DECAYING → SUSPECTED_INVALID → NEEDS_REVALIDATION → INVALIDATED
                                                                         ARCHIVED
```

| Field | Meaning |
| --- | --- |
| `validity_state` | One of the states above |
| `validity_signals[]` | Causal triggers (type, severity, reason, evidence) |
| `invalidation_reason_chain` | Change event → assumption → impact |
| `decay_penalty` | Confidence reduction from active signals |
| `decision_validity_health` | Rollup counts on Knowledge Health |

**Decay / impact triggers:** code & architecture drift · dependency add/remove (manifest baseline) · owner change · assumption failure · superseded / ADR conflict · propagated impact.

**Thresholds (shared):** stale verify = **60 days** (`LIFECYCLE_POLICY.staleVerifyDays`); expire = **180 days**. Cognitive Health ADR stale warnings use the same 60-day policy.

## CLI

```bash
contorium lifecycle              # Knowledge Health dashboard
contorium lifecycle inspect      # Decision health + causes
contorium review                 # Review queue only
contorium why <decision-id>      # Impact / validity chain
contorium lifecycle owner <id> --owner <name>
contorium lifecycle verify <id> [--type …] [--by …] [--reason …] [--evidence …]
contorium lifecycle expire <id> --days <n>
contorium inspect decisions      # Alias → lifecycle inspect
```

## Ask Contorium

| Question | Route |
| --- | --- |
| What needs review? | `review` |
| Knowledge health / stale decisions? | `knowledge_health` / `lifecycle` |
| Why was X decided / why invalid? | `decision` + lifecycle trust / impact chain |

## IDE

Sidebar **Explore** menu: Review Queue · Knowledge Health · Set Owner · Verify Decision

**Top-of-sidebar governance banner** (not a screen-center modal):

- Shows Decision / Changed / Assumption / Impact / Reason
- Actions: Review · Confirm Still Valid · Update · Ignore
- Queue: ‹ › to cycle alerts · Open Review Queue

## MCP Tools

| Tool | Description |
| --- | --- |
| `get_knowledge_health` | Lifecycle dashboard |
| `get_review_queue` | Review queue |
| `set_decision_lifecycle_meta` | Owner / verify (+ reason & evidence) / expiry |

## Dashboard

- **A/B** — Live Cognition / Governance Overlay (MCP mode)
- **C/D** — Debug Trace / Project History (**local lenses**, Enter applies)
- **E** — LLM Config

## Pipeline

```text
Change Events (git · manifests · cognitive · candidates)
        ↓
Assumption Graph + Decision Dependency Graph
        ↓
Impact Engine → invalidation_reason_chain
        ↓
Validity Engine + Confidence + Review Queue
        ↓
IDE banner · CLI why · MCP meta · Ask overlay
```

Implementation: `packages/state-core/src/lifecycle/` · `cil/changeEventEngine.ts`

## Related

- Spec notes: [优化.md](../优化.md) · [KNOWLEDGE_LIFECYCLE_OPTIMIZATION_BREAKDOWN.md](./KNOWLEDGE_LIFECYCLE_OPTIMIZATION_BREAKDOWN.md)
- Cognitive Health: complementary quality signals (shared stale threshold)
- Governance v4: change review (orthogonal to decision lifecycle)
