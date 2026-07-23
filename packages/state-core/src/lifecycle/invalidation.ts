import type { AdrRecord } from '../cil/types.js';
import type { CodeDecisionTension } from './codeContradiction.js';
import { extractAdrAssumptions, detectAssumptionFailures } from './assumption.js';
import { decayPenaltyForSignals, invalidationScoreFromPenalty } from './decayPolicy.js';
import { scanDependencyValiditySignals } from './dependencyScanner.js';
import type { DecisionImpactResult } from './impactEngine.js';
import type {
  AdrAssumption,
  DecisionLifecycleMeta,
  LifecycleDecisionStatus,
  SupersededContext,
  ValiditySignal,
  ValidityState,
  InvalidationChainLink,
} from './types.js';

export interface InvalidationInput {
  adr: AdrRecord;
  meta: DecisionLifecycleMeta;
  lifecycleStatus: LifecycleDecisionStatus;
  codeHits: CodeDecisionTension[];
  conflictRefs: string[];
  expired: boolean;
  supersededContext?: SupersededContext;
  impact?: DecisionImpactResult;
}

const SEVERITY_RANK: Record<ValiditySignal['severity'], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function ownerChangeSignal(meta: DecisionLifecycleMeta): ValiditySignal | undefined {
  if (!meta.previous_owner?.trim() || !meta.owner?.trim()) {
    return undefined;
  }
  if (meta.previous_owner === meta.owner) {
    return undefined;
  }
  if (
    meta.verified_at &&
    meta.owner_changed_at &&
    Date.parse(meta.verified_at) >= Date.parse(meta.owner_changed_at)
  ) {
    return undefined;
  }
  return {
    type: 'OWNER_CHANGE',
    detected_at: meta.owner_changed_at ?? new Date().toISOString(),
    reason: `Owner changed from ${meta.previous_owner} to ${meta.owner}`,
    severity: 'medium',
    evidence: `${meta.previous_owner} → ${meta.owner}`,
    detail: 'New owner should re-confirm this decision still holds',
  };
}

export function conflictValiditySignals(conflictRefs: string[]): ValiditySignal[] {
  if (!conflictRefs.length) {
    return [];
  }
  const now = new Date().toISOString();
  return [
    {
      type: 'ADR_CONFLICT',
      detected_at: now,
      reason: `Contradicted by related decision(s): ${conflictRefs.join(', ')}`,
      severity: 'high',
      evidence: conflictRefs.join(', '),
      detail: 'ADR or implementation tension with peer decisions',
    },
  ];
}

export function codeChangeValiditySignals(codeHits: CodeDecisionTension[]): ValiditySignal[] {
  const now = new Date().toISOString();
  return codeHits.map((hit) => {
    const isArch = /monolith|microservice|architecture/i.test(hit.detail);
    const severity: ValiditySignal['severity'] =
      hit.confidence >= 0.8 ? 'high' : hit.confidence >= 0.65 ? 'medium' : 'low';
    return {
      type: isArch ? 'ARCHITECTURE_CHANGE' : 'CODE_CHANGE',
      detected_at: now,
      reason: hit.detail,
      severity,
      evidence: hit.evidence_path ?? hit.code_signal,
      detail:
        hit.matched_decision_term && hit.matched_code_term
          ? `${hit.matched_decision_term} vs ${hit.matched_code_term}`
          : 'Implementation drift detected in recent code',
    };
  });
}

export function supersededValiditySignal(
  adr: AdrRecord,
  ctx?: SupersededContext,
): ValiditySignal | undefined {
  if (adr.status !== 'superseded') {
    return undefined;
  }
  return {
    type: 'SUPERSEDED',
    detected_at: new Date().toISOString(),
    reason: ctx?.reason ?? `Superseded by ${adr.superseded_by ?? 'a newer decision'}`,
    severity: 'critical',
    evidence: ctx?.replacement ?? adr.superseded_by,
    detail: 'Decision is no longer authoritative',
  };
}

export function resolveValidityState(
  lifecycleStatus: LifecycleDecisionStatus,
  signals: ValiditySignal[],
  expired: boolean,
  decayPenalty = 0,
  impactLevel?: DecisionImpactResult['impact'],
): ValidityState {
  if (lifecycleStatus === 'ARCHIVED') {
    return 'ARCHIVED';
  }
  if (lifecycleStatus === 'SUPERSEDED' || lifecycleStatus === 'DEPRECATED') {
    return 'INVALIDATED';
  }
  if (signals.some((s) => s.type === 'SUPERSEDED')) {
    return 'INVALIDATED';
  }
  if (signals.some((s) => s.type === 'ASSUMPTION_FAILURE' && s.severity !== 'low')) {
    return 'NEEDS_REVALIDATION';
  }
  if (signals.some((s) => s.severity === 'critical')) {
    return 'INVALIDATED';
  }
  const highInvalidation = signals.some(
    (s) =>
      s.severity === 'high' &&
      (s.type === 'CODE_CHANGE' ||
        s.type === 'DEPENDENCY_CHANGE' ||
        s.type === 'DEPENDENCY_REMOVAL' ||
        s.type === 'ARCHITECTURE_CHANGE' ||
        s.type === 'ADR_CONFLICT' ||
        s.type === 'ASSUMPTION_FAILURE'),
  );
  if (highInvalidation || (expired && signals.length > 0)) {
    return 'NEEDS_REVALIDATION';
  }
  if (impactLevel === 'high' || decayPenalty >= 45) {
    return 'SUSPECTED_INVALID';
  }
  if (impactLevel === 'medium' || decayPenalty >= 25) {
    return 'DECAYING';
  }
  if (signals.length) {
    const allLow = signals.every((s) => s.severity === 'low');
    return allLow ? 'WARNING' : 'DECAYING';
  }
  return 'VALID';
}

export function suggestedValidityAction(
  state: ValidityState,
  signals: ValiditySignal[],
  decisionId: string,
): string | undefined {
  if (state === 'VALID') {
    return undefined;
  }
  const primary = [...signals].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  )[0];

  switch (primary?.type) {
    case 'ASSUMPTION_FAILURE':
      return 'Re-validate business assumptions; update or supersede the ADR if conditions changed';
    case 'CODE_CHANGE':
    case 'ARCHITECTURE_CHANGE':
      return `Review implementation alignment, then: contorium lifecycle verify ${decisionId} --type manual --by <name>`;
    case 'DEPENDENCY_CHANGE':
    case 'DEPENDENCY_REMOVAL':
      return 'Review whether the technology choice still applies to the current stack';
    case 'OWNER_CHANGE':
      return `New owner should confirm: contorium lifecycle verify ${decisionId} --type manual --by <name>`;
    case 'ADR_CONFLICT':
      return 'Resolve ADR tension or supersede conflicting decisions';
    case 'SUPERSEDED':
      return `Follow replacement decision ${primary.evidence ?? ''}`.trim();
    default:
      if (
        state === 'NEEDS_REVALIDATION' ||
        state === 'INVALIDATED' ||
        state === 'SUSPECTED_INVALID'
      ) {
        return `Run: contorium lifecycle verify ${decisionId} --type manual --by <name>`;
      }
      if (state === 'WARNING') {
        return 'Monitor change signals; confirm still valid if stack or scale shifts';
      }
      return 'Monitor validity signals and re-verify when convenient';
  }
}

export function formatValidityStateLabel(state: ValidityState): string {
  switch (state) {
    case 'VALID':
      return 'Valid';
    case 'WARNING':
      return 'Warning';
    case 'DECAYING':
      return 'Decaying';
    case 'SUSPECTED_INVALID':
      return 'Suspected invalid';
    case 'NEEDS_REVALIDATION':
      return 'Needs revalidation';
    case 'INVALIDATED':
      return 'Invalidated';
    case 'ARCHIVED':
      return 'Archived';
  }
}

/** Aggregate five decay triggers into validity causality (优化.md §三). */
export async function computeDecisionInvalidation(
  workspaceRoot: string,
  input: InvalidationInput,
): Promise<{
  validity_state: ValidityState;
  validity_signals: ValiditySignal[];
  invalidation_score: number;
  decay_penalty: number;
  assumptions: AdrAssumption[];
  superseded_context?: SupersededContext;
  invalidation_reason_chain?: InvalidationChainLink[];
}> {
  const assumptions = input.meta.assumptions?.length
    ? input.meta.assumptions
    : extractAdrAssumptions(input.adr);

  const [depSignals, assumptionSignals] = await Promise.all([
    scanDependencyValiditySignals(workspaceRoot, input.adr),
    detectAssumptionFailures(workspaceRoot, input.adr, assumptions),
  ]);

  const ownerSig = ownerChangeSignal(input.meta);
  const supersededSig = supersededValiditySignal(input.adr, input.supersededContext);

  const impactSignal = input.impact?.signal;
  const signals: ValiditySignal[] = [
    ...codeChangeValiditySignals(input.codeHits),
    ...conflictValiditySignals(input.conflictRefs),
    ...depSignals,
    ...assumptionSignals,
    ...(ownerSig ? [ownerSig] : []),
    ...(supersededSig ? [supersededSig] : []),
    ...(impactSignal ? [impactSignal] : []),
  ];

  const decay_penalty = decayPenaltyForSignals(signals);
  const invalidation_score = invalidationScoreFromPenalty(decay_penalty);
  const validity_state = resolveValidityState(
    input.lifecycleStatus,
    signals,
    input.expired,
    decay_penalty,
    input.impact?.impact,
  );

  return {
    validity_state,
    validity_signals: signals,
    invalidation_score,
    decay_penalty,
    assumptions,
    superseded_context: input.supersededContext,
    invalidation_reason_chain: input.impact?.chain,
  };
}
