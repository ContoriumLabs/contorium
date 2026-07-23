import { readJsonFile } from '../intelligence/dimensions/io.js';
import { readStateJson } from '../bootstrap/bootstrapState.js';
import { collectChangeEvents } from '../cil/changeEventEngine.js';
import { detectDecisionContradictions } from '../cil/decisionConsistency.js';
import { readAllAdrRecords, readAllCognitiveEvents } from '../cil/eventStore.js';
import { detectProjectDrift } from '../cil/pik/drift.js';
import { ensureProjectIntentKernel } from '../cil/pik/generator.js';
import { detectCodeDecisionTensions } from './codeContradiction.js';
import { computeDecisionConfidence } from './confidence.js';
import { buildDecisionEvolutionChain, buildSupersededContext, mapAdrToLifecycleStatus } from './evolution.js';
import { persistAssumptionGraph } from './assumptionGraph.js';
import { persistDecisionDependencyGraph } from './decisionDependencyGraph.js';
import { computeDecisionImpacts, formatDecisionWhyChain } from './impactEngine.js';
import {
  computeFreshnessScore,
  daysSinceUsed,
  daysSinceVerified,
  formatFreshnessWarning,
  inferLastUsedAt,
  isDecisionExpired,
} from './freshness.js';
import {
  computeDecisionInvalidation,
  formatValidityStateLabel,
  suggestedValidityAction,
} from './invalidation.js';
import { lifecycleMetaPath } from './paths.js';
import { LIFECYCLE_POLICY } from './policy.js';
import type {
  DecisionLifecycleMeta,
  DecisionLifecycleRecord,
  KnowledgeHealthDimensions,
  KnowledgeHealthReport,
  KnowledgeLifecycleIndex,
  LifecycleEvidenceRef,
  ReviewQueueItem,
  DecisionValidityHealth,
} from './types.js';
import { KNOWLEDGE_HEALTH_SCHEMA, KNOWLEDGE_LIFECYCLE_SCHEMA } from './types.js';

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

async function readDecisionMeta(
  workspaceRoot: string,
  decisionId: string,
): Promise<DecisionLifecycleMeta> {
  const raw = await readJsonFile<DecisionLifecycleMeta>(lifecycleMetaPath(workspaceRoot, decisionId));
  return raw ?? {};
}

function conflictRefsFor(
  decisionId: string,
  conflicts: ReturnType<typeof detectDecisionContradictions>,
): string[] {
  return conflicts
    .filter((c) => c.decision === decisionId || c.by === decisionId)
    .map((c) => (c.decision === decisionId ? c.by : c.decision));
}

export function buildReviewQueue(records: DecisionLifecycleRecord[]): ReviewQueueItem[] {
  const items: ReviewQueueItem[] = [];
  for (const r of records) {
    if (r.conflict_refs.length) {
      items.push({
        decision_id: r.decision_id,
        title: r.title,
        reason: 'conflict',
        detail: `Conflicts with ${r.conflict_refs.join(', ')}`,
        severity: 'high',
        action_hint: `Inspect evidence, then verify or update ${r.decision_id}.`,
        evidence: r.evidence.filter((e) => e.source === 'code' || e.source === 'adr'),
      });
    }
    if (r.expired) {
      items.push({
        decision_id: r.decision_id,
        title: r.title,
        reason: 'expired',
        detail: `Not verified for ${r.days_since_verified ?? '?'} days`,
        days: r.days_since_verified,
        severity: 'high',
        action_hint: `Run: contorium lifecycle verify ${r.decision_id} --type manual --by <name>`,
      });
    } else if (r.needs_review) {
      items.push({
        decision_id: r.decision_id,
        title: r.title,
        reason: 'stale',
        detail: `Freshness ${r.freshness_score}% - verify decision still holds`,
        days: r.days_since_verified,
        severity: 'medium',
        action_hint: `Re-check and run: contorium lifecycle verify ${r.decision_id} --type manual --by <name>`,
      });
    }
    if (!r.meta.owner?.trim() && r.lifecycle_status === 'ACTIVE') {
      items.push({
        decision_id: r.decision_id,
        title: r.title,
        reason: 'missing_owner',
        detail: 'Unknown ownership',
        severity: 'low',
        action_hint: `Run: contorium lifecycle owner ${r.decision_id} --owner <name>`,
      });
    }
    if (!r.last_verified_at && r.lifecycle_status === 'ACTIVE') {
      items.push({
        decision_id: r.decision_id,
        title: r.title,
        reason: 'unverified',
        detail: 'Never verified against current codebase',
        severity: 'medium',
        action_hint: `Run: contorium lifecycle verify ${r.decision_id} --type manual --by <name>`,
      });
    }

    const actionableSignals = r.validity_signals.filter(
      (s) =>
        s.severity === 'high' ||
        s.severity === 'critical' ||
        (s.type === 'OWNER_CHANGE' && s.severity === 'medium'),
    );
    if (r.validity_state === 'SUSPECTED_INVALID') {
      items.push({
        decision_id: r.decision_id,
        title: r.title,
        reason: 'invalidation_trigger',
        trigger_type: 'ARCHITECTURE_CHANGE',
        detail:
          r.invalidation_reason_chain?.find((c) => c.type === 'DECISION_IMPACT')?.impact ??
          r.invalidation_reason_chain?.[1]?.event ??
          'High-impact change propagated to this decision',
        severity: 'high',
        action_hint: suggestedValidityAction(r.validity_state, r.validity_signals, r.decision_id),
      });
    }
    const coveredTypes = new Set<string>(
      items
        .filter((i) => i.decision_id === r.decision_id)
        .flatMap((i) => (i.reason === 'conflict' ? ['ADR_CONFLICT'] : [])),
    );
    for (const sig of actionableSignals) {
      if (coveredTypes.has(sig.type)) {
        continue;
      }
      coveredTypes.add(sig.type);
      items.push({
        decision_id: r.decision_id,
        title: r.title,
        reason: 'invalidation_trigger',
        trigger_type: sig.type,
        detail: sig.reason,
        severity: sig.severity === 'critical' ? 'critical' : sig.severity,
        action_hint: suggestedValidityAction(r.validity_state, [sig], r.decision_id),
        evidence: sig.evidence
          ? [{ source: 'metadata' as const, detail: sig.evidence, term: sig.type }]
          : undefined,
      });
    }
  }

  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
  return items
    .sort((a, b) => {
      const severity = severityRank[b.severity] - severityRank[a.severity];
      return severity !== 0 ? severity : (b.days ?? 0) - (a.days ?? 0);
    })
    .slice(0, LIFECYCLE_POLICY.maxReviewQueueItems);
}

function buildDecisionValidityHealth(
  records: DecisionLifecycleRecord[],
  unresolvedImpacts: number,
): DecisionValidityHealth {
  const active = records.filter((r) => r.lifecycle_status === 'ACTIVE');
  return {
    active_decisions: active.length,
    valid_decisions: records.filter((r) => r.validity_state === 'VALID').length,
    warning_decisions: records.filter((r) => r.validity_state === 'WARNING').length,
    decaying_decisions: records.filter((r) => r.validity_state === 'DECAYING').length,
    suspected_invalid_decisions: records.filter((r) => r.validity_state === 'SUSPECTED_INVALID').length,
    needs_revalidation_decisions: records.filter((r) => r.validity_state === 'NEEDS_REVALIDATION').length,
    invalidated_decisions: records.filter((r) => r.validity_state === 'INVALIDATED').length,
    unresolved_impacts: unresolvedImpacts,
  };
}

function buildKnowledgeHealth(
  records: DecisionLifecycleRecord[],
  reviewItems: ReviewQueueItem[],
  driftScore: number,
  derivedFrom: string[],
  validityHealth: DecisionValidityHealth,
): KnowledgeHealthReport {
  const n = records.length || 1;
  const avgFresh = records.reduce((s, r) => s + r.freshness_score, 0) / n;
  const avgConf = records.reduce((s, r) => s + r.confidence.overall, 0) / n;
  const withOwner = records.filter((r) => r.meta.owner?.trim()).length;
  const verified = records.filter((r) => r.last_verified_at).length;
  const conflicts = records.filter((r) => r.conflict_refs.length).length;
  const expired = records.filter((r) => r.expired).length;
  const stale = records.filter((r) => r.needs_review && !r.expired).length;

  const dimensions: KnowledgeHealthDimensions = {
    completeness: clamp100(records.length ? Math.min(100, 40 + records.length * 8) : 20),
    freshness: clamp100(avgFresh),
    ownership: clamp100((withOwner / n) * 100),
    verification: clamp100((verified / n) * 100),
    conflict: clamp100(
      conflicts ? Math.max(10, 100 - conflicts * LIFECYCLE_POLICY.conflictPenaltyPerDecision) : 100,
    ),
    drift: clamp100(100 - driftScore * 100),
    review_debt: clamp100(
      Math.max(0, 100 - reviewItems.length * LIFECYCLE_POLICY.reviewDebtPenaltyPerItem),
    ),
    overall: 0,
  };

  dimensions.overall = clamp100(
    dimensions.completeness * 0.1 +
      dimensions.freshness * 0.2 +
      dimensions.ownership * 0.1 +
      dimensions.verification * 0.15 +
      dimensions.conflict * 0.2 +
      dimensions.drift * 0.1 +
      dimensions.review_debt * 0.15,
  );

  const score = clamp100((dimensions.overall + avgConf) / 2);

  const formatted: string[] = [
    'Knowledge Health (Lifecycle)',
    '',
    `Score: ${score}%`,
    '',
    `Freshness ${dimensions.freshness}% | Verification ${dimensions.verification}% | Conflict ${dimensions.conflict}%`,
    `Ownership ${dimensions.ownership}% | Drift ${dimensions.drift}% | Review debt ${dimensions.review_debt}%`,
    '',
    expired ? `${expired} expired decision(s)` : 'No expired decisions',
    stale ? `${stale} stale decision(s)` : '',
    conflicts ? `${conflicts} decision(s) with conflicts` : '',
    reviewItems.length ? `${reviewItems.length} item(s) in review queue` : 'Review queue clear',
    '',
    'Decision validity health:',
    `Valid ${validityHealth.valid_decisions} | Warning ${validityHealth.warning_decisions} | Decaying ${validityHealth.decaying_decisions}`,
    `Suspected invalid ${validityHealth.suspected_invalid_decisions} | Needs revalidation ${validityHealth.needs_revalidation_decisions} | Invalidated ${validityHealth.invalidated_decisions}`,
    validityHealth.unresolved_impacts
      ? `${validityHealth.unresolved_impacts} unresolved impact(s)`
      : 'No unresolved impacts',
  ].filter(Boolean);

  return {
    schema: KNOWLEDGE_HEALTH_SCHEMA,
    updated_at: new Date().toISOString(),
    projection_of: 'cognitive_events',
    derived_from: derivedFrom,
    score,
    dimensions,
    expired_decisions: expired,
    stale_decisions: stale,
    conflict_count: conflicts,
    missing_owner_count: records.filter((r) => !r.meta.owner?.trim()).length,
    unverified_count: records.filter((r) => !r.last_verified_at).length,
    decision_validity_health: validityHealth,
    formatted,
  };
}

/** Compute full Knowledge Lifecycle projection from CIL ADRs. */
export async function computeKnowledgeLifecycle(workspaceRoot: string): Promise<KnowledgeLifecycleIndex> {
  const [adrs, state, events] = await Promise.all([
    readAllAdrRecords(workspaceRoot),
    readStateJson(workspaceRoot),
    readAllCognitiveEvents(workspaceRoot),
  ]);
  const conflicts = detectDecisionContradictions(adrs);
  const recentPaths = [
    ...(state?.gitWorking ?? []),
    ...(state?.gitStaged ?? []),
    ...(state?.recentFiles ?? []),
    ...events.slice(0, 24).flatMap((e) => e.files),
  ];
  const codeTensions = await detectCodeDecisionTensions(adrs, recentPaths, workspaceRoot);
  const pik = await ensureProjectIntentKernel(workspaceRoot).catch(() => null);
  const drift = pik
    ? await detectProjectDrift(workspaceRoot, pik).catch(() => ({ drift_score: 0 }))
    : { drift_score: 0 };

  const [assumptionGraph, depGraph, changeEvents] = await Promise.all([
    persistAssumptionGraph(workspaceRoot, adrs),
    persistDecisionDependencyGraph(workspaceRoot, adrs),
    collectChangeEvents(workspaceRoot),
  ]);
  const impacts = computeDecisionImpacts(changeEvents, depGraph, assumptionGraph);
  const impactByDecision = new Map(impacts.map((i) => [i.decision_id, i]));
  const adrIds = new Set(adrs.map((a) => a.id));

  const records: DecisionLifecycleRecord[] = [];

  for (const adr of adrs) {
    const meta = await readDecisionMeta(workspaceRoot, adr.id);
    const inferredUsed = inferLastUsedAt(adr, events);
    const lastUsedAt = meta.last_used_at ?? inferredUsed;
    let conflictRefs = conflictRefsFor(adr.id, conflicts);
    const codeHits = codeTensions.filter((t) => t.decision_id === adr.id);
    if (codeHits.length) {
      const codeExtras = codeHits
        .map((h) => h.code_signal)
        .filter((signal) => !adrIds.has(signal));
      conflictRefs = [...new Set([...conflictRefs, ...codeExtras])];
    }
    const freshnessScore = computeFreshnessScore(adr, meta, lastUsedAt);
    const expired = isDecisionExpired(adr, meta);
    const lifecycleStatus = mapAdrToLifecycleStatus(adr.status);
    const supersededContext = buildSupersededContext(adr, adrs);
    const impact = impactByDecision.get(adr.id);
    const invalidation = await computeDecisionInvalidation(workspaceRoot, {
      adr,
      meta,
      lifecycleStatus,
      codeHits,
      conflictRefs,
      expired,
      supersededContext,
      impact,
    });
    const needsReview =
      expired ||
      freshnessScore < 50 ||
      invalidation.validity_state === 'NEEDS_REVALIDATION' ||
      invalidation.validity_state === 'INVALIDATED' ||
      invalidation.validity_state === 'SUSPECTED_INVALID' ||
      (invalidation.validity_state === 'DECAYING' &&
        invalidation.decay_penalty >= LIFECYCLE_POLICY.decayReviewPenaltyThreshold);
    const evolution = buildDecisionEvolutionChain(adrs, adr.id);
    const warnings: string[] = [];
    const evidence: LifecycleEvidenceRef[] = [
      {
        source: 'adr',
        detail: `ADR ${adr.id} (${adr.status}) recorded ${adr.date}`,
        confidence: 1,
      },
    ];
    for (const hit of codeHits) {
      evidence.push({
        source: 'code',
        path: hit.evidence_path,
        term: hit.matched_code_term,
        detail: hit.detail,
        confidence: hit.confidence,
      });
    }

    const recordDraft: DecisionLifecycleRecord = {
      decision_id: adr.id,
      title: adr.title,
      adr_status: adr.status,
      lifecycle_status: lifecycleStatus,
      created_at: adr.date,
      last_verified_at: meta.verified_at ?? adr.last_verified,
      days_since_verified: daysSinceVerified(adr, meta),
      last_used_at: lastUsedAt,
      days_since_used: daysSinceUsed(meta, lastUsedAt),
      freshness_score: freshnessScore,
      expired,
      needs_review: needsReview,
      meta: { ...meta, last_used_at: lastUsedAt },
      confidence: computeDecisionConfidence(
        adr,
        meta,
        conflictRefs,
        freshnessScore,
        invalidation.decay_penalty,
      ),
      superseded_by: adr.superseded_by,
      supersedes: adrs.filter((a) => a.superseded_by === adr.id).map((a) => a.id),
      evolution_chain: evolution,
      conflict_refs: conflictRefs,
      evidence,
      formatted_warnings: warnings,
      validity_state: invalidation.validity_state,
      validity_signals: invalidation.validity_signals,
      invalidation_score: invalidation.invalidation_score,
      decay_penalty: invalidation.decay_penalty,
      superseded_context: invalidation.superseded_context,
      assumptions: invalidation.assumptions,
      invalidation_reason_chain: invalidation.invalidation_reason_chain,
    };

    const freshnessWarn = formatFreshnessWarning(recordDraft);
    if (freshnessWarn) {
      warnings.push(freshnessWarn);
    }
    if (conflictRefs.length) {
      warnings.push(`Contradicted by related decision(s): ${conflictRefs.join(', ')}`);
    }
    for (const hit of codeHits) {
      warnings.push(`Code tension: ${hit.detail}`);
      if (hit.confidence >= 0.75 && !meta.verified_at) {
        warnings.push('Automatic code scan suggests re-verification (contorium lifecycle verify)');
      }
    }
    if (adr.status === 'superseded' && adr.superseded_by) {
      warnings.push(`Superseded by ${adr.superseded_by}`);
    }
    for (const sig of invalidation.validity_signals) {
      warnings.push(`Validity (${sig.type}): ${sig.reason}`);
    }
    if (invalidation.invalidation_reason_chain?.length) {
      warnings.push(
        `Impact chain: ${formatDecisionWhyChain(invalidation.invalidation_reason_chain).join(' → ')}`,
      );
    }

    records.push({ ...recordDraft, formatted_warnings: warnings });
  }

  const review_queue = buildReviewQueue(records);
  const validityHealth = buildDecisionValidityHealth(
    records,
    impacts.filter((i) => i.impact !== 'low').length,
  );
  const health = buildKnowledgeHealth(
    records,
    review_queue,
    drift.drift_score ?? 0,
    adrs.map((a) => a.id),
    validityHealth,
  );

  return {
    schema: KNOWLEDGE_LIFECYCLE_SCHEMA,
    updated_at: new Date().toISOString(),
    projection_of: 'cognitive_events',
    derived_from: adrs.map((a) => a.id),
    decisions: records,
    health,
    review_queue,
  };
}

export function formatReviewQueue(index: KnowledgeLifecycleIndex): string[] {
  const lines = ['Review Queue', ''];
  if (!index.review_queue.length) {
    lines.push('No items need review.');
    return lines;
  }
  for (const item of index.review_queue) {
    const days = item.days != null ? ` | ${item.days} days` : '';
    const trigger = item.trigger_type ? ` (${item.trigger_type})` : '';
    lines.push(`- [${item.severity}] ${item.title} - ${item.reason}${trigger}${days}`, `  ${item.detail}`);
    if (item.action_hint) {
      lines.push(`  Next: ${item.action_hint}`);
    }
    for (const ev of item.evidence?.slice(0, 2) ?? []) {
      const where = ev.path ? ` (${ev.path})` : '';
      lines.push(`  Evidence: ${ev.detail}${where}`);
    }
    lines.push('');
  }
  return lines;
}

export function findDecisionLifecycle(
  index: KnowledgeLifecycleIndex,
  decisionIdOrTopic: string,
): DecisionLifecycleRecord | undefined {
  const needle = decisionIdOrTopic.toLowerCase();
  return (
    index.decisions.find((d) => d.decision_id === decisionIdOrTopic) ??
    index.decisions.find((d) => d.title.toLowerCase().includes(needle)) ??
    index.decisions.find((d) => needle.includes(d.decision_id.toLowerCase()))
  );
}

/** Format lifecycle trust block for Ask decision answers. */
export function formatDecisionLifecycleAnswer(
  record: DecisionLifecycleRecord,
  adrs: import('../cil/types.js').AdrRecord[],
): string {
  const validityIcon =
    record.validity_state === 'VALID'
      ? ''
      : record.validity_state === 'WARNING'
        ? '◦'
        : record.validity_state === 'DECAYING'
          ? '⚠'
          : record.validity_state === 'SUSPECTED_INVALID'
            ? '⚠'
            : record.validity_state === 'NEEDS_REVALIDATION'
              ? '⚠'
              : record.validity_state === 'ARCHIVED'
                ? '—'
                : '✕';

  const lines = [
    `**${record.title}**`,
    '',
    `**Validity:** ${validityIcon ? `${validityIcon} ` : ''}${formatValidityStateLabel(record.validity_state)}`,
  ];

  const primarySignal = [...record.validity_signals].sort((a, b) => {
    const rank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    return rank[b.severity] - rank[a.severity];
  })[0];
  if (primarySignal && record.validity_state !== 'VALID') {
    lines.push(`**Why:** ${primarySignal.reason}`);
  }

  if (record.invalidation_reason_chain?.length) {
    lines.push('', '**Impact chain:**');
    for (const step of formatDecisionWhyChain(record.invalidation_reason_chain)) {
      lines.push(`- ${step}`);
    }
  }

  const suggested = suggestedValidityAction(
    record.validity_state,
    record.validity_signals,
    record.decision_id,
  );
  if (suggested) {
    lines.push(`**Suggested action:** ${suggested}`);
  }

  lines.push(
    '',
    `**Confidence:** ${record.confidence.overall}%${record.decay_penalty ? ` (decay −${record.decay_penalty})` : ''}`,
    `**Status:** ${record.lifecycle_status} (${record.adr_status})`,
    record.last_verified_at
      ? `**Verified:** ${record.last_verified_at.slice(0, 10)} (${record.days_since_verified} days ago)`
      : '**Verified:** never',
    record.last_used_at
      ? `**Last used:** ${record.last_used_at.slice(0, 10)}${record.days_since_used != null ? ` (${record.days_since_used} days ago)` : ''}`
      : '**Last used:** no recent activity link',
    `**Freshness:** ${record.freshness_score}%`,
    '',
  );

  if (record.superseded_context?.replacement) {
    lines.push(`**Replacement:** ${record.superseded_context.replacement}`);
    if (record.superseded_context.reason) {
      lines.push(`**Superseded reason:** ${record.superseded_context.reason}`);
    }
    lines.push('');
  }

  if (record.evolution_chain.length > 1) {
    const labels = record.evolution_chain.map((id) => {
      const a = adrs.find((x) => x.id === id);
      return a ? `${a.title}` : id;
    });
    lines.push('**Evolution:**', labels.join(' -> '), '');
  }

  if (record.conflict_refs.length) {
    lines.push(`**Conflict:** implementation or ADR tension detected (${record.conflict_refs.join(', ')})`, '');
  }

  const codeWarning = record.formatted_warnings.find((w) => w.startsWith('Code tension:'));
  if (codeWarning) {
    lines.push(`**Implementation signal:** ${codeWarning.replace(/^Code tension:\s*/, '')}`, '');
  }

  if (record.formatted_warnings.length) {
    lines.push('**Trust warnings:**', ...record.formatted_warnings.map((w) => `- ${w}`), '');
  }

  lines.push(
    '_Lifecycle: validity | source | freshness | conflict | ownership | verification | consistency | usage_',
  );

  return lines.join('\n');
}

/** Format "why" output for CLI inspect / why commands (优化.md §13). */
export function formatDecisionWhyAnswer(record: DecisionLifecycleRecord): string[] {
  const lines = [
    `Why this decision changed: ${record.decision_id}`,
    '',
    `Validity: ${formatValidityStateLabel(record.validity_state)}`,
    `Confidence: ${record.confidence.overall}%`,
    '',
  ];

  if (record.invalidation_reason_chain?.length) {
    lines.push(...formatDecisionWhyChain(record.invalidation_reason_chain), '');
  } else if (record.validity_signals.length) {
    record.validity_signals.slice(0, 4).forEach((sig, idx) => {
      lines.push(`${idx + 1}. ${sig.reason}`);
    });
    lines.push('');
  } else {
    lines.push('No invalidation chain recorded — decision appears valid.', '');
  }

  const topAssumption = record.assumptions?.[0]?.statement;
  if (topAssumption) {
    lines.push(`Affected assumption: ${topAssumption}`, '');
  }

  const suggested = suggestedValidityAction(
    record.validity_state,
    record.validity_signals,
    record.decision_id,
  );
  if (suggested) {
    lines.push(`Suggested: ${suggested}`);
  }

  return lines;
}
