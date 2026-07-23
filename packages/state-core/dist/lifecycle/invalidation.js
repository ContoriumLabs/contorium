"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerChangeSignal = ownerChangeSignal;
exports.conflictValiditySignals = conflictValiditySignals;
exports.codeChangeValiditySignals = codeChangeValiditySignals;
exports.supersededValiditySignal = supersededValiditySignal;
exports.resolveValidityState = resolveValidityState;
exports.suggestedValidityAction = suggestedValidityAction;
exports.formatValidityStateLabel = formatValidityStateLabel;
exports.computeDecisionInvalidation = computeDecisionInvalidation;
const assumption_js_1 = require("./assumption.js");
const decayPolicy_js_1 = require("./decayPolicy.js");
const dependencyScanner_js_1 = require("./dependencyScanner.js");
const SEVERITY_RANK = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
};
function ownerChangeSignal(meta) {
    if (!meta.previous_owner?.trim() || !meta.owner?.trim()) {
        return undefined;
    }
    if (meta.previous_owner === meta.owner) {
        return undefined;
    }
    if (meta.verified_at &&
        meta.owner_changed_at &&
        Date.parse(meta.verified_at) >= Date.parse(meta.owner_changed_at)) {
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
function conflictValiditySignals(conflictRefs) {
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
function codeChangeValiditySignals(codeHits) {
    const now = new Date().toISOString();
    return codeHits.map((hit) => {
        const isArch = /monolith|microservice|architecture/i.test(hit.detail);
        const severity = hit.confidence >= 0.8 ? 'high' : hit.confidence >= 0.65 ? 'medium' : 'low';
        return {
            type: isArch ? 'ARCHITECTURE_CHANGE' : 'CODE_CHANGE',
            detected_at: now,
            reason: hit.detail,
            severity,
            evidence: hit.evidence_path ?? hit.code_signal,
            detail: hit.matched_decision_term && hit.matched_code_term
                ? `${hit.matched_decision_term} vs ${hit.matched_code_term}`
                : 'Implementation drift detected in recent code',
        };
    });
}
function supersededValiditySignal(adr, ctx) {
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
function resolveValidityState(lifecycleStatus, signals, expired, decayPenalty = 0, impactLevel) {
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
    const highInvalidation = signals.some((s) => s.severity === 'high' &&
        (s.type === 'CODE_CHANGE' ||
            s.type === 'DEPENDENCY_CHANGE' ||
            s.type === 'DEPENDENCY_REMOVAL' ||
            s.type === 'ARCHITECTURE_CHANGE' ||
            s.type === 'ADR_CONFLICT' ||
            s.type === 'ASSUMPTION_FAILURE'));
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
function suggestedValidityAction(state, signals, decisionId) {
    if (state === 'VALID') {
        return undefined;
    }
    const primary = [...signals].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];
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
            if (state === 'NEEDS_REVALIDATION' ||
                state === 'INVALIDATED' ||
                state === 'SUSPECTED_INVALID') {
                return `Run: contorium lifecycle verify ${decisionId} --type manual --by <name>`;
            }
            if (state === 'WARNING') {
                return 'Monitor change signals; confirm still valid if stack or scale shifts';
            }
            return 'Monitor validity signals and re-verify when convenient';
    }
}
function formatValidityStateLabel(state) {
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
async function computeDecisionInvalidation(workspaceRoot, input) {
    const assumptions = input.meta.assumptions?.length
        ? input.meta.assumptions
        : (0, assumption_js_1.extractAdrAssumptions)(input.adr);
    const [depSignals, assumptionSignals] = await Promise.all([
        (0, dependencyScanner_js_1.scanDependencyValiditySignals)(workspaceRoot, input.adr),
        (0, assumption_js_1.detectAssumptionFailures)(workspaceRoot, input.adr, assumptions),
    ]);
    const ownerSig = ownerChangeSignal(input.meta);
    const supersededSig = supersededValiditySignal(input.adr, input.supersededContext);
    const impactSignal = input.impact?.signal;
    const signals = [
        ...codeChangeValiditySignals(input.codeHits),
        ...conflictValiditySignals(input.conflictRefs),
        ...depSignals,
        ...assumptionSignals,
        ...(ownerSig ? [ownerSig] : []),
        ...(supersededSig ? [supersededSig] : []),
        ...(impactSignal ? [impactSignal] : []),
    ];
    const decay_penalty = (0, decayPolicy_js_1.decayPenaltyForSignals)(signals);
    const invalidation_score = (0, decayPolicy_js_1.invalidationScoreFromPenalty)(decay_penalty);
    const validity_state = resolveValidityState(input.lifecycleStatus, signals, input.expired, decay_penalty, input.impact?.impact);
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
