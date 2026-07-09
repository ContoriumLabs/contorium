import type { AdrRecord } from '../cil/types.js';
import type { CodeDecisionTension } from './codeContradiction.js';
import type { AdrAssumption, DecisionLifecycleMeta, LifecycleDecisionStatus, SupersededContext, ValiditySignal, ValidityState } from './types.js';
export interface InvalidationInput {
    adr: AdrRecord;
    meta: DecisionLifecycleMeta;
    lifecycleStatus: LifecycleDecisionStatus;
    codeHits: CodeDecisionTension[];
    conflictRefs: string[];
    expired: boolean;
    supersededContext?: SupersededContext;
}
export declare function ownerChangeSignal(meta: DecisionLifecycleMeta): ValiditySignal | undefined;
export declare function conflictValiditySignals(conflictRefs: string[]): ValiditySignal[];
export declare function codeChangeValiditySignals(codeHits: CodeDecisionTension[]): ValiditySignal[];
export declare function supersededValiditySignal(adr: AdrRecord, ctx?: SupersededContext): ValiditySignal | undefined;
export declare function resolveValidityState(lifecycleStatus: LifecycleDecisionStatus, signals: ValiditySignal[], expired: boolean): ValidityState;
export declare function suggestedValidityAction(state: ValidityState, signals: ValiditySignal[], decisionId: string): string | undefined;
export declare function formatValidityStateLabel(state: ValidityState): string;
/** Aggregate five decay triggers into validity causality (优化.md §三). */
export declare function computeDecisionInvalidation(workspaceRoot: string, input: InvalidationInput): Promise<{
    validity_state: ValidityState;
    validity_signals: ValiditySignal[];
    invalidation_score: number;
    decay_penalty: number;
    assumptions: AdrAssumption[];
    superseded_context?: SupersededContext;
}>;
//# sourceMappingURL=invalidation.d.ts.map