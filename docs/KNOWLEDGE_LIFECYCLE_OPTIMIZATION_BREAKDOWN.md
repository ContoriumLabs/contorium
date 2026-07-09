# Knowledge Lifecycle Optimization Breakdown

This document breaks `优化.md` into smaller implementation batches for the current Contorium architecture.

Current baseline:

- `packages/state-core/src/lifecycle/` already exists.
- CIL kernel already routes `review`, `lifecycle`, `knowledge_health`, and decision answers through lifecycle logic.
- CLI already exposes `contorium review` and `contorium lifecycle`.
- IDE CIL panel already has a Knowledge Lifecycle overlay.
- Several source strings contain mojibake in comments/output text and should be cleaned before expanding the surface.

## Architecture Target

Upgrade Contorium from persistent project memory to living project intelligence:

```text
STATE -> DECISION -> LIFECYCLE -> CONFIDENCE -> ANSWER
```

Every decision should pass through a lifecycle/trust filter before it is shown in Ask, Decision Center, health reports, dashboard, MCP tools, or exports.

## Original Points From `优化.md`

1. Knowledge Freshness Engine
   - Track created date, last used date, last verified date, freshness score, stale warnings.
   - Example output: `This decision has not been verified for 620 days.`

2. Contradiction Engine
   - Detect tension between decisions and current implementation.
   - Surface conflicts in Decision Center and trust metadata.

3. Decision Status
   - Add lifecycle status: `ACTIVE`, `SUPERSEDED`, `DEPRECATED`, `ARCHIVED`, `UNKNOWN`.
   - Avoid answering old decisions as if they are still true.

4. Owner Engine
   - Track `owner`, `reviewer`, `confirmed_by`.
   - Flag active decisions with missing ownership.

5. Verification Engine
   - Track `verified_at`, `verified_by`, `verification_type`.
   - Support automatic, manual, and LLM-assisted verification.

6. Knowledge Confidence
   - Split overall confidence into source, freshness, conflict, ownership, verification, consistency, and usage.
   - Use the fused score in answers and health.

7. Decision Graph
   - Model `supersedes` / `superseded_by`.
   - Show evolution chains such as `Redis -> Valkey -> Dragonfly`.

8. Knowledge Expiration
   - Add `expire_after` / `expire_after_days`.
   - Mark expired decisions as needing review.

9. Review Queue
   - Add `contorium review`.
   - Prioritize stale, expired, unverified, conflicting, and ownerless decisions.

10. Knowledge Health
    - Expand health to completeness, freshness, ownership, verification, conflict, drift, and review debt.

11. Ask Project Upgrade
    - Attach lifecycle trust metadata to decision answers.
    - Include confidence, status, verification age, freshness, and implementation conflicts.

12. Dashboard Knowledge Governance
    - Add Knowledge Governance view:
      fresh decisions, stale decisions, conflicts, expired, needs review, missing owners, verification, timeline.

## Additional Points For This Repository

13. Encoding and Output Hygiene
    - Replace mojibake in user-facing strings, comments, and CLI usage text.
    - Prefer ASCII arrows/separators in terminal output for stable cross-platform rendering.

14. Lifecycle Artifact Contract
    - Document `.contora/lifecycle/index.json`, `review-queue.json`, and `decisions/*.json`.
    - Version schemas explicitly and keep future migrations possible.

15. Metadata Editing UX
    - Add a safe CLI path to update decision lifecycle metadata.
    - Candidate commands:
      - `contorium lifecycle verify <decision-id> --type manual --by <name>`
      - `contorium lifecycle owner <decision-id> --owner <name>`
      - `contorium lifecycle expire <decision-id> --days 180`

16. Better Code Contradiction Signals
    - Current contradiction detection is path/keyword based.
    - Add source-content scanning for bounded file sets.
    - Track evidence paths and matched terms, not just a generic signal.

17. MCP Lifecycle Tools
    - Expose lifecycle as explicit MCP tools:
      - `get_knowledge_lifecycle`
      - `get_review_queue`
      - `verify_decision_lifecycle`
      - `update_decision_owner`

18. Dashboard Governance Integration
    - CLI dashboard currently focuses on governance/provenance.
    - Add Knowledge Health score and review queue summary to dashboard snapshots.

19. IDE Command Surface
    - Add explicit VS Code commands for Knowledge Lifecycle and Review Queue.
    - Keep the existing CIL panel overlay, but make lifecycle directly discoverable.

20. Query Router Coverage
    - Ensure natural questions route correctly:
      - "what decisions are stale?"
      - "which memories are still true?"
      - "what needs review?"
      - "is this decision still valid?"

21. Test Fixtures
    - Add focused lifecycle fixtures for:
      - stale accepted decision
      - superseded decision chain
      - missing owner
      - manual verification
      - code contradiction
      - empty ADR store

22. Export and Transfer Integration
    - Include lifecycle health in AI-ready exports where decision context is included.
    - Avoid overloading compact transfer output; add lifecycle only where trust matters.

23. Migration and Backfill
    - Backfill lifecycle metadata from existing ADR fields where possible.
    - Keep legacy ADRs valid when lifecycle metadata does not exist.

24. Review Queue Actions
    - Add action hints per review item:
      - verify
      - assign owner
      - mark deprecated
      - link successor
      - inspect conflict evidence

25. Health Threshold Policy
    - Centralize thresholds for stale, expired, conflict severity, review debt.
    - Avoid magic numbers spread across lifecycle modules.

26. Lifecycle Traceability
    - Add trace fields showing which engines influenced a lifecycle score.
    - Useful for debugging confidence and explaining health changes.

27. Documentation Update
    - Update README and CIL docs with Living Project Intelligence language.
    - Add CLI examples for `review`, `lifecycle`, and trust-enriched `ask`.

## Stepwise Optimization Plan

### Batch 1: Hygiene And Contract Stabilization

Goal: make existing lifecycle output trustworthy before adding features.

- Fix mojibake in lifecycle, CLI, and dashboard user-facing strings.
- Add/adjust lifecycle docs for artifact paths and schema fields.
- Centralize lifecycle thresholds in one module.
- Run TypeScript build for `state-core` and `cli`.

### Batch 2: Lifecycle Metadata UX

Goal: make owner/verification/expiration metadata editable without hand-writing JSON.

- Add CLI subcommands for owner, verify, and expiration metadata.
- Validate decision IDs before writing metadata.
- Persist metadata under `.contora/lifecycle/decisions/*.json`.
- Add tests for read/write metadata and review queue changes.

### Batch 3: Stronger Contradiction Engine

Goal: improve conflict evidence quality.

- Extend code contradiction detection beyond recent path names.
- Scan bounded relevant source files from state/recent events.
- Return evidence: path, matched decision term, matched code term, confidence.
- Show evidence in Ask and Review Queue.

### Batch 4: Review Queue Actions

Goal: make review queue operational, not just diagnostic.

- Add action hints and suggested commands to each queue item.
- Sort by severity, age, and confidence impact.
- Include grouped output by conflict/stale/unverified/missing owner.

### Batch 5: MCP Surface

Goal: expose lifecycle to agent clients.

- Add read-only MCP tools for lifecycle and review queue.
- Add guarded metadata update tools if consistent with existing control surface.
- Return compact JSON with paths and schema versions.

### Batch 6: Dashboard Knowledge Governance

Goal: make lifecycle visible during normal work.

- Add Knowledge Health and review queue summary to dashboard state.
- Add compact panel lines for stale/conflict/ownerless decisions.
- Keep output width-safe and terminal-safe.

### Batch 7: IDE Commands And Sidebar Integration

Goal: make lifecycle discoverable in VS Code.

- Add commands for lifecycle report and review queue.
- Surface Knowledge Health in sidebar CIL/governance panel.
- Add direct Ask shortcuts for lifecycle-related questions.

### Batch 8: Export And Ask Refinement

Goal: make AI answers lifecycle-aware without excessive noise.

- Ensure decision answers always include trust metadata.
- Add concise lifecycle summary to relevant AI-ready exports.
- Avoid lifecycle blocks for unrelated factual/project navigation answers.

### Batch 9: Tests And Regression Fixtures

Goal: lock behavior before larger releases.

- Add fixtures covering stale, expired, superseded, conflict, missing owner, and manual verification.
- Add CLI smoke tests for `review`, `lifecycle`, metadata update commands.
- Add query router tests for lifecycle phrasing.

### Batch 10: Product Documentation

Goal: make the architecture understandable to users.

- Update README and docs with "Living Project Intelligence".
- Add examples for stale authority, superseded decisions, and review queue.
- Document `.contora/lifecycle/` artifacts and safe manual edits.

## Recommended Execution Order

1. Batch 1
2. Batch 2
3. Batch 3
4. Batch 4
5. Batch 5
6. Batch 6
7. Batch 7
8. Batch 8
9. Batch 9
10. Batch 10

The first implementation slice should be Batch 1 because it reduces risk for every later change and fixes visible quality issues without changing the lifecycle data model.
